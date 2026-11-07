// SPDX-License-Identifier: AGPL-3.0-or-later

use super::{instance_config_result, parse_tristate};
use crate::{
    api::{
        client::AdminApiClient,
        types::{
            InstanceBlueskyIntegrationUpdateRequest, InstanceBlueskyKeyIntegrationUpdateRequest,
            InstanceConfigUpdateRequest, InstanceIntegrationsUpdateRequest,
            InstanceYoutubeIntegrationUpdateRequest,
        },
    },
    middleware::flash::FlashData,
    utils::forms::MultiValueForm,
};

pub(super) async fn run(client: &AdminApiClient, form: &MultiValueForm) -> FlashData {
    let result = client
        .update_instance_config(&build_integrations_update(form))
        .await;
    instance_config_result(result)
}

fn build_integrations_update(form: &MultiValueForm) -> InstanceConfigUpdateRequest {
    let clean = |key: &str| form.clean(key);
    let bluesky_key_id = clean("integration_bluesky_key_id");
    let bluesky_private_key = clean("integration_bluesky_private_key");
    let bluesky_keys = match (bluesky_key_id, bluesky_private_key) {
        (Some(kid), private_key) => Some(vec![InstanceBlueskyKeyIntegrationUpdateRequest {
            kid,
            private_key,
        }]),
        _ => None,
    };
    InstanceConfigUpdateRequest {
        integrations: Some(InstanceIntegrationsUpdateRequest {
            youtube: Some(InstanceYoutubeIntegrationUpdateRequest {
                api_key: clean("integration_youtube_api_key"),
            }),
            bluesky: Some(InstanceBlueskyIntegrationUpdateRequest {
                enabled: parse_tristate(form, "integration_bluesky_enabled"),
                client_name: clean("integration_bluesky_client_name"),
                client_uri: clean("integration_bluesky_client_uri"),
                logo_uri: clean("integration_bluesky_logo_uri"),
                tos_uri: clean("integration_bluesky_tos_uri"),
                policy_uri: clean("integration_bluesky_policy_uri"),
                keys: bluesky_keys,
            }),
        }),
        ..Default::default()
    }
}
