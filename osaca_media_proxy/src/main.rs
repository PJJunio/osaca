// SPDX-License-Identifier: AGPL-3.0-or-later

use clap::Parser;
use osaca_media_proxy::{cli, run};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main(flavor = "multi_thread")]
async fn main() -> anyhow::Result<()> {
    let args = cli::Args::parse();
    if matches!(args.command, Some(cli::Command::Healthcheck)) {
        return osaca_common::healthcheck::run(
            "OSACA_MEDIA_PROXY_HOST",
            "OSACA_MEDIA_PROXY_PORT",
            8080,
        )
        .await;
    }

    tracing_subscriber::registry()
        .with(osaca_common::config::env_filter("info"))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let cfg = cli::load_config(&args)?;
    run(cfg).await
}
