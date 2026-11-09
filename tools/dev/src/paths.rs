// SPDX-License-Identifier: AGPL-3.0-or-later

use anyhow::{Context, Result, bail};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::LazyLock;

pub static ROOT: LazyLock<PathBuf> = LazyLock::new(|| {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("tools/dev has a repository grandparent")
        .to_path_buf()
});

pub static DEV_STATE_DIR: LazyLock<PathBuf> = LazyLock::new(|| ROOT.join(".osaca/dev"));
pub static DEV_GATEWAY_DIR: LazyLock<PathBuf> = LazyLock::new(|| DEV_STATE_DIR.join("gateway"));
pub static DEV_LOG_DIR: LazyLock<PathBuf> = LazyLock::new(|| DEV_STATE_DIR.join("logs"));
pub static DEV_SEAWEEDFS_DIR: LazyLock<PathBuf> = LazyLock::new(|| DEV_STATE_DIR.join("seaweedfs"));
pub static DEV_SEAWEEDFS_PID_FILE: LazyLock<PathBuf> =
    LazyLock::new(|| DEV_SEAWEEDFS_DIR.join("seaweedfs.pid"));
pub static DEV_ENV_FILE: LazyLock<PathBuf> =
    LazyLock::new(|| ROOT.join("config/env/development.env"));
pub static DEV_LOCAL_ENV_FILE: LazyLock<PathBuf> =
    LazyLock::new(|| ROOT.join("config/env/local.env"));
pub static ROOT_LOCAL_ENV_FILE: LazyLock<PathBuf> = LazyLock::new(|| ROOT.join(".env.local"));
pub static TARGET_DIR: LazyLock<PathBuf> = LazyLock::new(|| ROOT.join("target"));
pub static DESKTOP_DIR: LazyLock<PathBuf> = LazyLock::new(|| ROOT.join("osaca_desktop"));
pub static GATEWAY_CONFIG_DIR: LazyLock<PathBuf> =
    LazyLock::new(|| ROOT.join("osaca_gateway/config"));

pub fn ensure_state_dirs() -> Result<()> {
    for path in [
        DEV_STATE_DIR.as_path(),
        DEV_GATEWAY_DIR.as_path(),
        DEV_LOG_DIR.as_path(),
        DEV_SEAWEEDFS_DIR.as_path(),
    ] {
        std::fs::create_dir_all(path)
            .with_context(|| format!("failed to create {}", path.display()))?;
    }
    Ok(())
}

pub fn ensure_writable_dev_paths() -> Result<()> {
    for path in [DEV_STATE_DIR.as_path(), TARGET_DIR.as_path()] {
        std::fs::create_dir_all(path)
            .with_context(|| format!("failed to create {}", path.display()))?;
        if is_writable(path) {
            continue;
        }
        let sudo = which("sudo").ok_or_else(|| {
            anyhow::anyhow!("{} is not writable and sudo is unavailable", path.display())
        })?;
        let owner = format!("{}:{}", current_uid(), current_gid());
        let status = Command::new(sudo)
            .args(["chown", "-R", &owner])
            .arg(path)
            .status()
            .with_context(|| format!("failed to chown {}", path.display()))?;
        if !status.success() {
            bail!("sudo chown failed for {}", path.display());
        }
    }
    Ok(())
}

pub fn which(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    #[cfg(windows)]
    let path_exts: Vec<String> = std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_owned())
        .split(';')
        .filter(|ext| !ext.is_empty())
        .map(|ext| ext.to_lowercase())
        .collect();

    let name_path = Path::new(name);
    let has_extension = name_path.extension().is_some();

    for dir in std::env::split_paths(&path) {
        if has_extension || !cfg!(windows) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
        #[cfg(windows)]
        if !has_extension {
            for ext in &path_exts {
                let candidate = dir.join(format!("{name}{ext}"));
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    #[cfg(windows)]
    if name == "sh" || name == "bash" {
        for candidate_str in [
            r"C:\Program Files\Git\bin\sh.exe",
            r"C:\Program Files\Git\usr\bin\sh.exe",
            r"C:\Program Files (x86)\Git\bin\sh.exe",
            r"C:\Program Files\Git\bin\bash.exe",
        ] {
            let candidate = PathBuf::from(candidate_str);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

pub fn resolve_executable(name: impl AsRef<Path>) -> PathBuf {
    let path = name.as_ref();
    #[cfg(windows)]
    {
        if path.components().count() > 1 {
            if path.is_file() {
                return path.to_path_buf();
            }
            if path.extension().is_none() {
                for ext in [".exe", ".cmd", ".bat"] {
                    let mut with_ext = path.as_os_str().to_os_string();
                    with_ext.push(ext);
                    let candidate = PathBuf::from(with_ext);
                    if candidate.is_file() {
                        return candidate;
                    }
                }
            }
            return path.to_path_buf();
        }

        if let Some(str_name) = path.to_str() {
            if let Some(found) = which(str_name) {
                return found;
            }
        }

        path.to_path_buf()
    }
    #[cfg(not(windows))]
    {
        path.to_path_buf()
    }
}

fn is_writable(path: &Path) -> bool {
    tempfile::NamedTempFile::new_in(path).is_ok()
}

#[cfg(unix)]
fn current_uid() -> u32 {
    unsafe { libc::geteuid() }
}

#[cfg(unix)]
fn current_gid() -> u32 {
    unsafe { libc::getegid() }
}

#[cfg(not(unix))]
fn current_uid() -> u32 {
    0
}

#[cfg(not(unix))]
fn current_gid() -> u32 {
    0
}
