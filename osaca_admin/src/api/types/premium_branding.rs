// SPDX-License-Identifier: AGPL-3.0-or-later

use super::{InstanceConfigResponse, PremiumMode};
use serde::Deserialize;

#[derive(Clone, Debug, Default, Deserialize)]
pub struct InstancePremiumDiscovery {
    #[serde(default)]
    pub app_public: InstancePremiumDiscoveryAppPublic,
    #[serde(default)]
    pub features: InstancePremiumDiscoveryFeatures,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct InstancePremiumDiscoveryAppPublic {
    #[serde(default)]
    pub branding: InstancePremiumDiscoveryBranding,
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct InstancePremiumDiscoveryBranding {
    pub product_name: Option<String>,
    pub icon_url: Option<String>,
    pub symbol_url: Option<String>,
    pub favicon_url: Option<String>,
    pub favicon_dark_url: Option<String>,
    pub premium_product_name: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct InstancePremiumDiscoveryFeatures {
    #[serde(default)]
    pub premium_enabled: bool,
    #[serde(default = "default_true")]
    pub discovery_enabled: bool,
}

impl Default for InstancePremiumDiscoveryFeatures {
    fn default() -> Self {
        Self {
            premium_enabled: false,
            discovery_enabled: true,
        }
    }
}

fn default_true() -> bool {
    true
}

impl InstancePremiumDiscovery {
    pub fn premium_product_name(&self) -> Option<&str> {
        non_blank(self.app_public.branding.premium_product_name.as_deref())
    }
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct PremiumBranding {
    pub name: Option<String>,
    pub premium_enabled: bool,
    pub discovery_enabled: bool,
    pub product_name: Option<String>,
    pub favicon_url: Option<String>,
    pub favicon_dark_url: Option<String>,
    pub neutral_default_avatars: bool,
}

impl PremiumBranding {
    pub fn from_discovery(discovery: &InstancePremiumDiscovery) -> Self {
        let branding = &discovery.app_public.branding;
        Self {
            name: discovery.premium_product_name().map(str::to_owned),
            premium_enabled: discovery.features.premium_enabled,
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
            ..Self::from_config_parts(
                config.self_hosted,
                &branding.premium_product_name,
                config.policy.premium_mode,
            )
        }
    }

    fn from_config_parts(self_hosted: bool, name: &str, premium_mode: PremiumMode) -> Self {
        Self {
            name: non_blank(Some(name)).map(str::to_owned),
            premium_enabled: !self_hosted || matches!(premium_mode, PremiumMode::Mirror),
            discovery_enabled: true,
            ..Self::default()
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
