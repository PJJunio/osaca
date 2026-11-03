// SPDX-License-Identifier: AGPL-3.0-or-later

use osaca_common::config::{parse_bool, parse_number};

use anyhow::Context as _;
use osaca_common::secret::SecretString;
use serde::Deserialize;
use std::net::{IpAddr, SocketAddr};

pub const RPC_AUTH_HEADER: &str = "x-osaca-rpc-auth";
pub const DEFAULT_APP_ID: &str = "stable";

const RPC_PATH: &str = "/internal/rpc";
const DEFAULT_HOST: &str = "0.0.0.0";
const DEFAULT_DELIVERY_PORT: u16 = 8126;
const DEFAULT_NATS_URL: &str = "nats://127.0.0.1:4222";
const DEFAULT_QUEUE_CAPACITY: usize = 10_000;
const DEFAULT_SEND_CONCURRENCY: usize = 256;
const DEFAULT_FCM_TOKEN_URI: &str = "https://oauth2.googleapis.com/token";
const DEFAULT_FCM_BASE_URL: &str = "https://fcm.googleapis.com";
const APNS_PRODUCTION_BASE_URL: &str = "https://api.push.apple.com";
const APNS_DEVELOPMENT_BASE_URL: &str = "https://api.sandbox.push.apple.com";
const VOIP_TOPIC_SUFFIX: &str = ".voip";

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, clap::ValueEnum)]
pub enum Mode {
    #[default]
    Delivery,
}

impl Mode {
    pub fn default_port(self) -> u16 {
        match self {
            Self::Delivery => DEFAULT_DELIVERY_PORT,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProviderEnvironment {
    Production,
    Development,
}

impl ProviderEnvironment {
    pub fn label(self) -> &'static str {
        match self {
            Self::Production => "production",
            Self::Development => "development",
        }
    }

    pub fn from_label(raw: &str) -> Option<Self> {
        match raw {
            "production" => Some(Self::Production),
            "development" => Some(Self::Development),
            _ => None,
        }
    }
}

#[derive(Clone, Debug)]
pub struct ProviderApp {
    pub app_id: String,
    pub topic: Option<String>,
    pub voip_topic: Option<String>,
    pub environment: Option<ProviderEnvironment>,
    pub project_id: Option<String>,
}

#[derive(Debug)]
pub struct NatsConfig {
    pub url: String,
    pub auth_token: Option<SecretString>,
}

#[derive(Debug)]
pub struct RpcConfig {
    pub url: String,
    pub auth_token: SecretString,
}

#[derive(Debug)]
pub struct VapidConfig {
    pub email: String,
    pub public_key: String,
    pub private_key: SecretString,
}

#[derive(Debug)]
pub struct ApnsConfig {
    pub team_id: String,
    pub key_id: String,
    pub private_key: SecretString,
    pub default_environment: ProviderEnvironment,
    pub apps: Vec<ProviderApp>,
    pub base_url_override: Option<String>,
}

impl ApnsConfig {
    pub fn topic_for(&self, app_id: &str, environment: ProviderEnvironment) -> Option<&str> {
        self.topic_by(app_id, environment, |app| app.topic.as_deref())
    }

    pub fn voip_topic_for(&self, app_id: &str, environment: ProviderEnvironment) -> Option<&str> {
        self.topic_by(app_id, environment, |app| app.voip_topic.as_deref())
    }

    fn topic_by(
        &self,
        app_id: &str,
        environment: ProviderEnvironment,
        topic: fn(&ProviderApp) -> Option<&str>,
    ) -> Option<&str> {
        let listed = |app: &&ProviderApp| app.app_id == app_id && topic(app).is_some();
        self.apps
            .iter()
            .find(|app| listed(app) && app.environment == Some(environment))
            .or_else(|| self.apps.iter().find(listed))
            .and_then(topic)
    }

    pub fn base_url(&self, environment: ProviderEnvironment) -> &str {
        if let Some(base_url) = self.base_url_override.as_deref() {
            return base_url;
        }
        match environment {
            ProviderEnvironment::Production => APNS_PRODUCTION_BASE_URL,
            ProviderEnvironment::Development => APNS_DEVELOPMENT_BASE_URL,
        }
    }
}

#[derive(Debug)]
pub struct FcmConfig {
    pub project_id: String,
    pub client_email: String,
    pub private_key: SecretString,
    pub token_uri: String,
    pub apps: Vec<ProviderApp>,
    pub base_url: String,
}

impl FcmConfig {
    pub fn project_id_for(&self, app_id: &str) -> &str {
        self.apps
            .iter()
            .find(|app| app.app_id == app_id && app.project_id.is_some())
            .and_then(|app| app.project_id.as_deref())
            .unwrap_or(self.project_id.as_str())
    }

    pub fn listed_project_id(&self, app_id: &str) -> Option<&str> {
        self.apps
            .iter()
            .find(|app| app.app_id == app_id)
            .map(|app| {
                app.project_id
                    .as_deref()
                    .unwrap_or(self.project_id.as_str())
            })
    }
}

#[derive(Debug)]
pub struct DeliveryConfig {
    pub bind_addr: SocketAddr,
    pub nats: NatsConfig,
    pub rpc: RpcConfig,
    pub queue_capacity: usize,
    pub send_concurrency: usize,
    pub vapid: VapidConfig,
    pub apns: Option<ApnsConfig>,
    pub fcm: Option<FcmConfig>,
    pub private_hosts: Vec<String>,
}

#[derive(Debug)]
pub enum Config {
    Delivery(Box<DeliveryConfig>),
}

impl Config {
    pub fn load_from_iter<I, K, V>(mode: Mode, vars: I) -> anyhow::Result<Self>
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        Ok(match mode {
            Mode::Delivery => Self::Delivery(Box::new(DeliveryConfig::load_from_iter(vars)?)),
        })
    }

    pub fn bind_addr_mut(&mut self) -> &mut SocketAddr {
        match self {
            Self::Delivery(cfg) => &mut cfg.bind_addr,
        }
    }
}

impl DeliveryConfig {
    pub fn load_from_iter<I, K, V>(vars: I) -> anyhow::Result<Self>
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        let env = Env::from_iter(vars);
        Ok(Self {
            bind_addr: bind_addr(&env, Mode::Delivery)?,
            nats: nats_config(&env),
            rpc: rpc_config(&env)?,
            queue_capacity: parse_number(
                "OSACA_PUSH_SERVICE_QUEUE_CAPACITY",
                env.get("OSACA_PUSH_SERVICE_QUEUE_CAPACITY"),
                DEFAULT_QUEUE_CAPACITY,
                1,
                1_000_000,
            )?,
            send_concurrency: parse_number(
                "OSACA_PUSH_SERVICE_SEND_CONCURRENCY",
                env.get("OSACA_PUSH_SERVICE_SEND_CONCURRENCY"),
                DEFAULT_SEND_CONCURRENCY,
                1,
                65_536,
            )?,
            vapid: vapid_config(&env)?,
            apns: apns_config(&env)?,
            fcm: fcm_config(&env)?,
            private_hosts: host_list(&env, "OSACA_PUSH_SERVICE_PRIVATE_HOSTS"),
        })
    }
}

fn host_list(env: &Env, key: &str) -> Vec<String> {
    env.get(key)
        .unwrap_or_default()
        .split(',')
        .map(|host| host.trim().to_ascii_lowercase())
        .filter(|host| !host.is_empty())
        .collect()
}

fn bind_addr(env: &Env, mode: Mode) -> anyhow::Result<SocketAddr> {
    let host = env.get("OSACA_PUSH_SERVICE_HOST").unwrap_or(DEFAULT_HOST);
    let ip = host
        .parse::<IpAddr>()
        .with_context(|| format!("OSACA_PUSH_SERVICE_HOST is not an IP address: {host}"))?;
    let port = parse_number(
        "OSACA_PUSH_SERVICE_PORT",
        env.get("OSACA_PUSH_SERVICE_PORT"),
        mode.default_port(),
        1,
        u16::MAX,
    )?;
    Ok(SocketAddr::new(ip, port))
}

fn nats_config(env: &Env) -> NatsConfig {
    NatsConfig {
        url: env
            .get("OSACA_SVC_NATS_URL")
            .unwrap_or(DEFAULT_NATS_URL)
            .to_owned(),
        auth_token: env
            .get("OSACA_NATS_AUTH_TOKEN")
            .map(|token| SecretString::new(token.to_owned())),
    }
}

fn rpc_config(env: &Env) -> anyhow::Result<RpcConfig> {
    let api_endpoint = env
        .require("OSACA_INTERNAL_API_ENDPOINT")?
        .trim_end_matches('/')
        .to_owned();
    anyhow::ensure!(
        !api_endpoint.is_empty(),
        "OSACA_INTERNAL_API_ENDPOINT must not be only slashes"
    );
    Ok(RpcConfig {
        url: format!("{api_endpoint}{RPC_PATH}"),
        auth_token: SecretString::new(env.require("OSACA_GATEWAY_RPC_AUTH_TOKEN")?.to_owned()),
    })
}

fn vapid_config(env: &Env) -> anyhow::Result<VapidConfig> {
    Ok(VapidConfig {
        email: env.require("OSACA_VAPID_EMAIL")?.to_owned(),
        public_key: env.require("OSACA_VAPID_PUBLIC_KEY")?.to_owned(),
        private_key: SecretString::new(env.require("OSACA_VAPID_PRIVATE_KEY")?.to_owned()),
    })
}

fn apns_config(env: &Env) -> anyhow::Result<Option<ApnsConfig>> {
    if !parse_bool(
        "OSACA_PUSH_APNS_ENABLED",
        env.get("OSACA_PUSH_APNS_ENABLED"),
    )?
    .unwrap_or(false)
    {
        return Ok(None);
    }
    let default_environment = match env.get("OSACA_PUSH_APNS_DEFAULT_ENVIRONMENT") {
        Some(raw) => parse_environment("OSACA_PUSH_APNS_DEFAULT_ENVIRONMENT", raw)?,
        None => ProviderEnvironment::Production,
    };
    Ok(Some(ApnsConfig {
        team_id: required_field(
            env.get("OSACA_PUSH_APNS_TEAM_ID"),
            "OSACA_PUSH_APNS_TEAM_ID",
            "APNs push",
        )?
        .to_owned(),
        key_id: required_field(
            env.get("OSACA_PUSH_APNS_KEY_ID"),
            "OSACA_PUSH_APNS_KEY_ID",
            "APNs push",
        )?
        .to_owned(),
        private_key: SecretString::new(read_key(
            env,
            "OSACA_PUSH_APNS_PRIVATE_KEY",
            "OSACA_PUSH_APNS_PRIVATE_KEY_PATH",
            "APNs push",
        )?),
        default_environment,
        apps: parse_apps("OSACA_PUSH_APNS_APPS", env.get("OSACA_PUSH_APNS_APPS"))?,
        base_url_override: env
            .get("OSACA_PUSH_SERVICE_APNS_BASE_URL")
            .map(ToOwned::to_owned),
    }))
}

fn fcm_config(env: &Env) -> anyhow::Result<Option<FcmConfig>> {
    if !parse_bool(
        "OSACA_PUSH_FCM_ENABLED",
        env.get("OSACA_PUSH_FCM_ENABLED"),
    )?
    .unwrap_or(false)
    {
        return Ok(None);
    }
    let service_account = match env.get("OSACA_PUSH_FCM_SERVICE_ACCOUNT_JSON_PATH") {
        Some(path) => Some(read_service_account(path)?),
        None => None,
    };
    let project_id = env
        .get("OSACA_PUSH_FCM_PROJECT_ID")
        .map(ToOwned::to_owned)
        .or_else(|| service_account.as_ref().and_then(|a| a.project_id.clone()));
    let client_email = env
        .get("OSACA_PUSH_FCM_CLIENT_EMAIL")
        .map(ToOwned::to_owned)
        .or_else(|| {
            service_account
                .as_ref()
                .and_then(|a| a.client_email.clone())
        });
    let private_key = match env.get("OSACA_PUSH_FCM_PRIVATE_KEY") {
        Some(key) => key.to_owned(),
        None => match env.get("OSACA_PUSH_FCM_PRIVATE_KEY_PATH") {
            Some(path) => read_file("OSACA_PUSH_FCM_PRIVATE_KEY_PATH", path)?,
            None => service_account
                .as_ref()
                .and_then(|a| a.private_key.clone())
                .ok_or_else(|| {
                    anyhow::anyhow!(
                        "OSACA_PUSH_FCM_PRIVATE_KEY or OSACA_PUSH_FCM_PRIVATE_KEY_PATH is required when FCM push is enabled"
                    )
                })?,
        },
    };

    Ok(Some(FcmConfig {
        project_id: required_field(
            project_id.as_deref(),
            "OSACA_PUSH_FCM_PROJECT_ID",
            "FCM push",
        )?
        .to_owned(),
        client_email: required_field(
            client_email.as_deref(),
            "OSACA_PUSH_FCM_CLIENT_EMAIL",
            "FCM push",
        )?
        .to_owned(),
        private_key: SecretString::new(private_key),
        token_uri: env
            .get("OSACA_PUSH_FCM_TOKEN_URI")
            .unwrap_or(DEFAULT_FCM_TOKEN_URI)
            .to_owned(),
        apps: parse_apps("OSACA_PUSH_FCM_APPS", env.get("OSACA_PUSH_FCM_APPS"))?,
        base_url: env
            .get("OSACA_PUSH_SERVICE_FCM_BASE_URL")
            .unwrap_or(DEFAULT_FCM_BASE_URL)
            .to_owned(),
    }))
}

#[derive(Default, Deserialize)]
struct ServiceAccount {
    project_id: Option<String>,
    client_email: Option<String>,
    private_key: Option<String>,
}

fn read_service_account(path: &str) -> anyhow::Result<ServiceAccount> {
    let raw = read_file("OSACA_PUSH_FCM_SERVICE_ACCOUNT_JSON_PATH", path)?;
    serde_json::from_str(&raw).with_context(|| {
        format!("OSACA_PUSH_FCM_SERVICE_ACCOUNT_JSON_PATH is not a service account JSON: {path}")
    })
}

fn read_key(env: &Env, key_var: &str, path_var: &str, provider: &str) -> anyhow::Result<String> {
    if let Some(key) = env.get(key_var) {
        return Ok(key.to_owned());
    }
    match env.get(path_var) {
        Some(path) => read_file(path_var, path),
        None => Err(anyhow::anyhow!(
            "{key_var} or {path_var} is required when {provider} is enabled"
        )),
    }
}

fn read_file(var_name: &str, path: &str) -> anyhow::Result<String> {
    std::fs::read_to_string(path).with_context(|| format!("{var_name} could not be read: {path}"))
}

fn required_field<'a>(
    value: Option<&'a str>,
    var_name: &str,
    provider: &str,
) -> anyhow::Result<&'a str> {
    value.ok_or_else(|| anyhow::anyhow!("{var_name} is required when {provider} is configured"))
}

#[derive(Deserialize)]
struct RawProviderApp {
    app_id: Option<String>,
    topic: Option<String>,
    environment: Option<String>,
    project_id: Option<String>,
}

fn parse_apps(var_name: &str, raw: Option<&str>) -> anyhow::Result<Vec<ProviderApp>> {
    let Some(raw) = raw else {
        return Ok(Vec::new());
    };
    let entries: Vec<RawProviderApp> = serde_json::from_str(raw)
        .with_context(|| format!("{var_name} must be a JSON array of push app objects"))?;
    entries
        .into_iter()
        .map(|entry| {
            let app_id = entry
                .app_id
                .filter(|app_id| !app_id.trim().is_empty())
                .ok_or_else(|| anyhow::anyhow!("{var_name} contains an entry with no app_id"))?;
            let environment = match entry.environment.as_deref() {
                Some(value) => Some(parse_environment(var_name, value)?),
                None => None,
            };
            let topic = entry
                .topic
                .map(|topic| topic.trim().to_owned())
                .filter(|topic| !topic.is_empty());
            if let Some(topic) = topic.as_deref() {
                anyhow::ensure!(
                    !topic.ends_with(VOIP_TOPIC_SUFFIX),
                    "{var_name} lists a topic that already ends in {VOIP_TOPIC_SUFFIX}: {topic}"
                );
            }
            Ok(ProviderApp {
                app_id,
                voip_topic: topic
                    .as_deref()
                    .map(|topic| format!("{topic}{VOIP_TOPIC_SUFFIX}")),
                topic,
                environment,
                project_id: entry
                    .project_id
                    .filter(|project_id| !project_id.trim().is_empty()),
            })
        })
        .collect()
}

fn parse_environment(var_name: &str, raw: &str) -> anyhow::Result<ProviderEnvironment> {
    ProviderEnvironment::from_label(&raw.trim().to_ascii_lowercase())
        .ok_or_else(|| anyhow::anyhow!("{var_name} must be one of: production, development"))
}

struct Env(Vec<(String, String)>);

impl Env {
    fn from_iter<I, K, V>(vars: I) -> Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        Self(
            vars.into_iter()
                .map(|(key, value)| (key.into(), value.into()))
                .collect(),
        )
    }

    fn get(&self, key: &str) -> Option<&str> {
        self.0
            .iter()
            .find_map(|(name, value)| (name == key).then_some(value.trim()))
            .filter(|value| !value.is_empty())
    }

    fn require(&self, key: &str) -> anyhow::Result<&str> {
        self.get(key)
            .ok_or_else(|| anyhow::anyhow!("{key} is required"))
    }
}
