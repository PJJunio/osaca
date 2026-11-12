// SPDX-License-Identifier: AGPL-3.0-or-later

//! Which signed mobile and desktop apps an instance's domain trusts for links and saved credentials.
//!
//! OSACA publishes no apps of its own yet, so nothing is trusted unless the Operator configures the app
//! identity. The domain must never vouch for apps signed by someone else (issue #53).

use osaca_common::config as cfg;
use serde_json::{Value, json};

const APPLE_BUNDLE_IDS: [&str; 4] = [
    "app.osaca",
    "app.osaca.canary",
    "com.osaca",
    "com.osaca.canary",
];
const ANDROID_PACKAGES: [&str; 2] = ["com.osaca", "com.osaca.canary"];

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct MobileAppIdentity {
    pub apple_team_id: Option<String>,
    pub android_cert_fingerprints: Vec<String>,
}

impl MobileAppIdentity {
    pub fn from_env() -> Self {
        Self::parse(
            cfg::env_value("OSACA_APPLE_TEAM_ID"),
            cfg::env_value("OSACA_ANDROID_CERT_FINGERPRINTS"),
        )
    }

    pub fn parse(apple_team_id: Option<String>, android_cert_fingerprints: Option<String>) -> Self {
        Self {
            apple_team_id: apple_team_id
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty()),
            android_cert_fingerprints: android_cert_fingerprints
                .unwrap_or_default()
                .split(',')
                .map(|value| value.trim().to_ascii_uppercase())
                .filter(|value| !value.is_empty())
                .collect(),
        }
    }
}

/// The body of `/.well-known/apple-app-site-association`.
pub fn apple_app_site_association(identity: &MobileAppIdentity) -> Value {
    let apps: Vec<String> = identity
        .apple_team_id
        .iter()
        .flat_map(|team| APPLE_BUNDLE_IDS.map(|bundle| format!("{team}.{bundle}")))
        .collect();
    json!({"webcredentials": {"apps": apps}})
}

/// The body of `/.well-known/assetlinks.json`.
pub fn assetlinks(identity: &MobileAppIdentity) -> Value {
    if identity.android_cert_fingerprints.is_empty() {
        return json!([]);
    }
    Value::Array(
        ANDROID_PACKAGES
            .map(|package_name| {
                json!({
                    "relation": [
                        "delegate_permission/common.handle_all_urls",
                        "delegate_permission/common.get_login_creds"
                    ],
                    "target": {
                        "namespace": "android_app",
                        "package_name": package_name,
                        "sha256_cert_fingerprints": identity.android_cert_fingerprints,
                    }
                })
            })
            .to_vec(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_unconfigured_instance_trusts_no_apps() {
        let identity = MobileAppIdentity::parse(None, None);

        assert_eq!(
            apple_app_site_association(&identity),
            json!({"webcredentials": {"apps": []}})
        );
        assert_eq!(assetlinks(&identity), json!([]));
    }

    #[test]
    fn the_configured_apple_team_signs_every_osaca_bundle() {
        let identity = MobileAppIdentity::parse(Some(" ABCDE12345 ".to_owned()), None);

        assert_eq!(
            apple_app_site_association(&identity),
            json!({"webcredentials": {"apps": [
                "ABCDE12345.app.osaca",
                "ABCDE12345.app.osaca.canary",
                "ABCDE12345.com.osaca",
                "ABCDE12345.com.osaca.canary"
            ]}})
        );
    }

    #[test]
    fn the_configured_android_certificates_cover_both_packages() {
        let identity = MobileAppIdentity::parse(None, Some("aa:bb, CC:DD ,".to_owned()));
        let links = assetlinks(&identity);

        assert_eq!(links.as_array().map(Vec::len), Some(2));
        for (link, package) in links.as_array().unwrap().iter().zip(ANDROID_PACKAGES) {
            assert_eq!(link["target"]["package_name"], package);
            assert_eq!(
                link["target"]["sha256_cert_fingerprints"],
                json!(["AA:BB", "CC:DD"])
            );
            assert_eq!(
                link["relation"],
                json!([
                    "delegate_permission/common.handle_all_urls",
                    "delegate_permission/common.get_login_creds"
                ])
            );
        }
    }
}
