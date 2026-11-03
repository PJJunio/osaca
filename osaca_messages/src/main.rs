// SPDX-License-Identifier: AGPL-3.0-or-later

use osaca_messages::router_impl::MessagesRouter;
use osaca_messages::shard_impl::MessagesShard;
use osaca_svc::config::{DatabaseBackend, Mode, ServiceConfig};
use osaca_svc::transport::NatsTransport;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    osaca_svc::init_tracing();
    let config = ServiceConfig::from_env()?;
    let transport =
        NatsTransport::connect(&config.nats_url, config.nats_auth_token.as_deref()).await?;

    tracing::info!(
        service = config.service_name,
        mode = ?config.mode,
        shard_id = config.shard_id,
        shard_count = config.shard_count,
        listen_addr = %config.listen_addr,
        "starting messages service"
    );

    match config.mode {
        Mode::Router => {
            let router = MessagesRouter::new();
            osaca_svc::router::run_router(&config, router, transport).await
        }
        Mode::Shard => {
            let shard = build_shard(&config, &transport).await?;
            osaca_svc::shard::run_shard(&config, shard, transport).await
        }
        Mode::Combined => {
            let shard = build_shard(&config, &transport).await?;
            let router = MessagesRouter::new();
            osaca_svc::combined::run_combined(&config, router, shard, transport).await
        }
    }
}

async fn build_shard(
    config: &ServiceConfig,
    transport: &NatsTransport,
) -> anyhow::Result<MessagesShard<NatsTransport>> {
    match config.database_backend {
        DatabaseBackend::Postgres => {
            let postgres_config = osaca_svc::postgres::PostgresConfig::from_service_config(config);
            let pool = osaca_svc::postgres::connect(&postgres_config).await?;
            let kv = osaca_svc::postgres::KvClient::new(pool, &postgres_config)?;
            MessagesShard::new_postgres(kv, transport.clone())
        }
        DatabaseBackend::Cassandra => {
            #[cfg(feature = "scylla")]
            {
                let scylla_config = osaca_svc::scylla::ScyllaConfig::from_service_config(config);
                let db = osaca_svc::scylla::connect(&scylla_config).await?;
                MessagesShard::new_scylla(db, transport.clone()).await
            }
            #[cfg(not(feature = "scylla"))]
            {
                anyhow::bail!("OSACA_DATABASE_BACKEND=cassandra requires the scylla feature");
            }
        }
    }
}
