// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::config::{Config, DeliveryConfig};
use crate::delivery;
use crate::metrics::Metrics;
use crate::rpc::RpcClient;
use crate::tokens::TokenCache;
use crate::vendor;
use axum::Router;
use osaca_common::secret::SecretString;
use osaca_svc::shutdown::{DEFAULT_DRAIN_TIMEOUT, drain_with_timeout, wait_for_shutdown};
use osaca_svc::transport::NatsTransport;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::{oneshot, watch};
use tokio::task::JoinHandle;
use tracing::info;

const JOB_DRAIN_TIMEOUT: Duration = Duration::from_secs(25);

pub struct Sidecar {
    metrics: Arc<Metrics>,
    serving: Arc<AtomicBool>,
}

impl Sidecar {
    pub fn new(metrics: Arc<Metrics>) -> Self {
        Self {
            metrics,
            serving: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn router(&self) -> Router {
        let metrics = self.metrics.clone();
        osaca_svc::server::ops_router(self.serving.clone(), Arc::new(move || metrics.render()))
    }

    pub fn set_serving(&self, serving: bool) {
        self.serving.store(serving, Ordering::SeqCst);
    }
}

pub struct Serving {
    stop: oneshot::Sender<()>,
    served: JoinHandle<std::io::Result<()>>,
}

impl Serving {
    pub async fn stop(self) {
        let _ = self.stop.send(());
        drain_with_timeout(
            async {
                let _ = self.served.await;
            },
            DEFAULT_DRAIN_TIMEOUT,
        )
        .await;
    }
}

pub async fn serve(addr: SocketAddr, router: Router) -> anyhow::Result<Serving> {
    let listener = TcpListener::bind(addr).await?;
    let (stop, stopped) = oneshot::channel::<()>();
    let served = tokio::spawn(async move {
        axum::serve(
            listener,
            router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move {
            let _ = stopped.await;
        })
        .await
    });
    Ok(Serving { stop, served })
}

pub struct AppState {
    pub(crate) cfg: DeliveryConfig,
    pub(crate) metrics: Arc<Metrics>,
    pub(crate) sidecar: Arc<Sidecar>,
    pub(crate) rpc: RpcClient,
    pub(crate) http: reqwest::Client,
    pub(crate) web_push_http: reqwest::Client,
    pub(crate) apns_http: reqwest::Client,
    pub(crate) tokens: TokenCache,
    pub(crate) draining: watch::Sender<bool>,
}

impl AppState {
    pub(crate) fn try_new(cfg: DeliveryConfig) -> anyhow::Result<Self> {
        let metrics = Arc::new(Metrics::new());
        let http = vendor::http_client()?;
        Ok(Self {
            rpc: RpcClient::new(&cfg.rpc, http.clone(), Arc::clone(&metrics)),
            sidecar: Arc::new(Sidecar::new(Arc::clone(&metrics))),
            web_push_http: vendor::web_push_http_client(&cfg.private_hosts)?,
            apns_http: vendor::apns_http_client()?,
            tokens: TokenCache::new(),
            draining: watch::Sender::new(false),
            cfg,
            metrics,
            http,
        })
    }
}

pub async fn run(cfg: Config) -> anyhow::Result<()> {
    match cfg {
        Config::Delivery(cfg) => run_delivery(*cfg).await,
    }
}

async fn run_delivery(cfg: DeliveryConfig) -> anyhow::Result<()> {
    let state = Arc::new(AppState::try_new(cfg)?);
    let addr = state.cfg.bind_addr;
    let serving = serve(addr, state.sidecar.router()).await?;
    info!(%addr, vapid_subject = state.cfg.vapid.email, "push sidecar listening");

    let transport = NatsTransport::connect(
        &state.cfg.nats.url,
        state.cfg.nats.auth_token.as_ref().map(SecretString::expose),
    )
    .await?;

    state.sidecar.set_serving(true);

    let jobs = tokio::spawn(delivery::run_job_subscribers(transport, Arc::clone(&state)));

    wait_for_shutdown().await;
    state.sidecar.set_serving(false);
    drain_jobs(&state, jobs, JOB_DRAIN_TIMEOUT).await;
    serving.stop().await;
    Ok(())
}

async fn drain_jobs(state: &AppState, jobs: JoinHandle<()>, timeout: Duration) {
    state.draining.send_replace(true);
    let running = jobs.abort_handle();
    drain_with_timeout(
        async {
            let _ = jobs.await;
        },
        timeout,
    )
    .await;
    running.abort();
}
