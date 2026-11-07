// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    api::{
        client::{AdminApiClient, ApiResultExt},
        types::{AdminBranding, InstanceConfigResponse, ReportReasonEntry},
    },
    config::AdminConfig,
};
use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

const BRANDING_TTL: Duration = Duration::from_secs(60);

#[derive(Clone)]
pub struct AppState {
    inner: Arc<AppStateInner>,
}

struct AppStateInner {
    pub config: AdminConfig,
    pub http_client: reqwest::Client,
    branding_cache: Mutex<Option<(Instant, AdminBranding)>>,
    report_reasons: Mutex<Option<Arc<[ReportReasonEntry]>>>,
}

impl AppState {
    pub fn new(config: AdminConfig) -> Self {
        let http_client = reqwest::Client::builder()
            .user_agent(format!("OsacaAdmin/{} (Rust)", config.build_version))
            .build()
            .expect("failed to create HTTP client");
        Self {
            inner: Arc::new(AppStateInner {
                config,
                http_client,
                branding_cache: Mutex::new(None),
                report_reasons: Mutex::new(None),
            }),
        }
    }

    pub fn config(&self) -> &AdminConfig {
        &self.inner.config
    }

    pub fn http_client(&self) -> &reqwest::Client {
        &self.inner.http_client
    }

    pub fn cached_branding(&self) -> Option<AdminBranding> {
        let cache = self
            .inner
            .branding_cache
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        cache
            .as_ref()
            .filter(|(fetched_at, _)| fetched_at.elapsed() < BRANDING_TTL)
            .map(|(_, branding)| branding.clone())
    }

    pub fn remember_branding(&self, branding: AdminBranding) {
        *self
            .inner
            .branding_cache
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some((Instant::now(), branding));
    }

    pub fn remember_instance_config_branding(&self, instance_config: &InstanceConfigResponse) {
        self.merge_instance_config_branding(AdminBranding::from_instance_config(instance_config));
    }

    fn merge_instance_config_branding(&self, branding: AdminBranding) {
        let mut cache = self
            .inner
            .branding_cache
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some((fetched_at, previous)) = cache.as_ref() {
            let branding = AdminBranding {
                discovery_enabled: previous.discovery_enabled,
                ..branding
            };
            *cache = Some((*fetched_at, branding));
        }
    }

    pub async fn instance_branding(&self, client: &AdminApiClient) -> Option<AdminBranding> {
        if let Some(branding) = self.cached_branding() {
            return Some(branding);
        }
        let branding = AdminBranding::from_discovery(
            &client
                .get_instance_discovery()
                .await
                .log_error("load instance branding")?,
        );
        self.remember_branding(branding.clone());
        Some(branding)
    }

    pub async fn self_hosted_branding(&self) -> Option<AdminBranding> {
        if !self.config().self_hosted {
            return None;
        }
        self.instance_branding(&AdminApiClient::anonymous(
            self.http_client(),
            self.config(),
        ))
        .await
    }

    pub fn forget_instance_settings(&self) {
        *self
            .inner
            .branding_cache
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    }

    pub async fn report_reasons(
        &self,
        client: &AdminApiClient,
    ) -> Option<Arc<[ReportReasonEntry]>> {
        if let Some(reasons) = self.cached_report_reasons() {
            return Some(reasons);
        }
        let reasons: Arc<[ReportReasonEntry]> = client
            .list_report_reasons()
            .await
            .log_error("load report reasons")?
            .reasons
            .into();
        *self
            .inner
            .report_reasons
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(reasons.clone());
        Some(reasons)
    }

    fn cached_report_reasons(&self) -> Option<Arc<[ReportReasonEntry]>> {
        self.inner
            .report_reasons
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }
}

impl axum::extract::FromRef<AppState> for AdminConfig {
    fn from_ref(state: &AppState) -> Self {
        state.inner.config.clone()
    }
}
