// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::gateway::setup_gateway_config;
use crate::paths::{ensure_state_dirs, ensure_writable_dev_paths};
use crate::proc::{PNPM_INSTALL_ENV, RunOptions, run_command, wait_tcp};
use anyhow::Result;

pub async fn bootstrap(skip_install: bool) -> Result<()> {
    ensure_state_dirs()?;
    ensure_writable_dev_paths()?;
    if !skip_install {
        run_command(
            &["pnpm", "install", "--frozen-lockfile"],
            RunOptions {
                env: PNPM_INSTALL_ENV
                    .iter()
                    .map(|(key, value)| ((*key).to_owned(), Some((*value).to_owned())))
                    .collect(),
                ..RunOptions::default()
            },
        )?;
    }
    run_command(
        &["sh", "osaca_static/fetch-spellcheck-dictionaries.sh"],
        RunOptions::default(),
    )?;
    setup_gateway_config()?;
    wait_core_infra().await?;
    println!("OSACA dev bootstrap complete.");
    Ok(())
}

pub async fn post_start() -> Result<()> {
    ensure_state_dirs()?;
    ensure_writable_dev_paths()?;
    setup_gateway_config()?;
    crate::media_proxy::ensure_dev_object_store(true, 120).await?;
    Ok(())
}

async fn wait_service(name: &str, container_host: &str, port: u16, timeout_secs: u64) -> Result<()> {
    use std::net::ToSocketAddrs;
    let host = if format!("{container_host}:{port}").to_socket_addrs().is_ok() {
        container_host
    } else {
        "127.0.0.1"
    };
    wait_tcp(name, host, port, timeout_secs).await
}

pub async fn wait_core_infra() -> Result<()> {
    wait_service("Postgres", "postgres", 5432, 120).await?;
    wait_service("Valkey", "valkey", 6379, 120).await?;
    wait_service("NATS", "nats", 4222, 120).await?;
    wait_service("LiveKit", "livekit", 7880, 120).await?;
    crate::media_proxy::ensure_dev_object_store(true, 120).await?;
    Ok(())
}
