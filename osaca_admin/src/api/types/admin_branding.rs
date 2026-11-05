// SPDX-License-Identifier: AGPL-3.0-or-later

use super::InstanceConfigResponse;
use serde::Deserialize;

#[derive(Clone, Debug, Default, Deserialize)]
pub struct InstanceDiscovery {
    #[serde(default)]
    pub app_public: InstanceDiscoveryAppPublic,
    #[serde(default)]
    pub features: InstanceDiscoveryFeatures,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct InstanceDiscoveryAppPublic {
    #[serde(default)]
    pub branding: InstanceDiscoveryBranding,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct InstanceDiscoveryBranding {
    pub product_name: Option<String>,
    pub icon_url: Option<String>,
    pub symbol_url: Option<String>,
    pub favicon_url: Option<String>,
    pub favicon_dark_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct InstanceDiscoveryFeatures {
    #[serde(default = "default_true")]
    pub discovery_enabled: bool,
}

impl Default for InstanceDiscoveryFeatures {
    fn default() -> Self {
        Self {
            discovery_enabled: true,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct AdminBranding {
    pub discovery_enabled: bool,
    pub product_name: Option<String>,
    pub favicon_url: Option<String>,
    pub favicon_dark_url: Option<String>,
    pub neutral_default_avatars: bool,
}

impl AdminBranding {
    pub fn from_discovery(discovery: &InstanceDiscovery) -> Self {
        let branding = &discovery.app_public.branding;
        Self {
            discovery_enabled: discovery.features.discovery_enabled,
            product_name: non_blank(branding.product_name.as_deref()).map(str::to_owned),
            favicon_url: favicon_url(
                branding.favicon_url.as_deref(),
                branding.icon_url.as_deref(),
            ),
            favicon_dark_url: non_blank(branding.favicon_dark_url.as_deref()).map(str::to_owned),
            neutral_default_avatars: has_own_mark(
                branding.icon_url.as_deref(),
                branding.symbol_url.as_deref(),
            ),
        }
    }

    pub fn from_instance_config(config: &InstanceConfigResponse) -> Self {
        let branding = &config.app_public.branding;
        Self {
            product_name: non_blank(Some(&branding.product_name)).map(str::to_owned),
            favicon_url: favicon_url(
                branding.favicon_url.as_deref(),
                branding.icon_url.as_deref(),
            ),
            favicon_dark_url: non_blank(branding.favicon_dark_url.as_deref()).map(str::to_owned),
            neutral_default_avatars: has_own_mark(
                branding.icon_url.as_deref(),
                branding.symbol_url.as_deref(),
            ),
            discovery_enabled: true,
        }
    }
}

fn non_blank(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn has_own_mark(icon_url: Option<&str>, symbol_url: Option<&str>) -> bool {
    non_blank(icon_url).is_some() || non_blank(symbol_url).is_some()
}

fn favicon_url(favicon_url: Option<&str>, icon_url: Option<&str>) -> Option<String> {
    non_blank(favicon_url)
        .or_else(|| non_blank(icon_url))
        .map(str::to_owned)
}
