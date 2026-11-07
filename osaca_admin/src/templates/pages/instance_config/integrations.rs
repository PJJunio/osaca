// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::templates::pages::instance_config::ConfigForm;
use crate::{
    api::types::InstanceIntegrationsResponse,
    templates::components::{
        badge::{BadgeVariant, badge},
        form::{FORM_INPUT_CLASS, form_actions, form_field_group, submit_button, text_input},
        section_card::section_card_with_description,
    },
};
use maud::{Markup, html};

use super::inherit_select;

fn secret_badge(label: &str, is_set: bool) -> Markup {
    if is_set {
        badge(&format!("{label} set"), BadgeVariant::Success)
    } else {
        badge(&format!("{label} missing"), BadgeVariant::Default)
    }
}

fn password_input(name: &str, label: &str, helper: Option<&str>) -> Markup {
    form_field_group(
        label,
        name,
        false,
        None,
        helper,
        html! {
            input type="password" id=(name) name=(name) value="" class=(FORM_INPUT_CLASS)
                autocomplete="new-password";
        },
    )
}

const PEM_PLACEHOLDER: &str = "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg...\n-----END PRIVATE KEY-----";

fn private_key_input(name: &str, label: &str, helper: &str) -> Markup {
    form_field_group(
        label,
        name,
        false,
        None,
        Some(helper),
        html! {
            textarea id=(name) name=(name) rows="5" placeholder=(PEM_PLACEHOLDER) class={(FORM_INPUT_CLASS) " font-mono text-xs"}
                autocomplete="off" spellcheck="false" {}
        },
    )
}

pub(super) fn integrations_config_section(
    base: &str,
    config_form: ConfigForm<'_>,
    integrations: &InstanceIntegrationsResponse,
) -> Markup {
    section_card_with_description(
        "Runtime Integrations",
        "Configure optional providers without changing environment variables. Blank secret fields keep the current value.",
        html! {
            form method="post" action={(base) "/instance-config?action=update_integrations"} {
                (config_form.fields())
                div class="space-y-8" {
                    div class="space-y-4" {
                        div class="flex flex-wrap items-center gap-2" {
                            h3 class="text-sm font-semibold text-neutral-900" { "YouTube Data API" }
                            (secret_badge("API key", integrations.youtube.api_key_set))
                        }
                        (password_input("integration_youtube_api_key", "YouTube API key", Some("Leave blank to keep the current key.")))
                        p class="text-xs text-neutral-500" {
                            "The key needs YouTube Data API v3 enabled and a daily quota above 0. \
                             Restrict it by IP address or not at all. Website restrictions block it."
                        }
                    }

                    div class="space-y-4 border-t border-neutral-200 pt-6" {
                        div class="flex flex-wrap items-center gap-2" {
                            h3 class="text-sm font-semibold text-neutral-900" { "Bluesky OAuth" }
                            @if integrations.bluesky.effective_enabled {
                                (badge("Effective: enabled", BadgeVariant::Success))
                            } @else {
                                (badge("Effective: disabled", BadgeVariant::Default))
                            }
                            (badge(&format!("{} signing key(s)", integrations.bluesky.key_count), BadgeVariant::Default))
                        }
                        (inherit_select(
                            "integration_bluesky_enabled",
                            "Bluesky OAuth",
                            integrations.bluesky.enabled,
                        ))
                        div class="grid grid-cols-1 gap-4 sm:grid-cols-2" {
                            (text_input(
                                "integration_bluesky_client_name",
                                "Client name",
                                integrations.bluesky.client_name.as_deref().unwrap_or(""),
                                "OSACA",
                            ))
                            (text_input(
                                "integration_bluesky_client_uri",
                                "Client URL",
                                integrations.bluesky.client_uri.as_deref().unwrap_or(""),
                                "https://example.com",
                            ))
                            (text_input(
                                "integration_bluesky_logo_uri",
                                "Logo URL",
                                integrations.bluesky.logo_uri.as_deref().unwrap_or(""),
                                "https://example.com/logo.png",
                            ))
                            (text_input(
                                "integration_bluesky_tos_uri",
                                "Terms URL",
                                integrations.bluesky.tos_uri.as_deref().unwrap_or(""),
                                "https://example.com/terms",
                            ))
                            (text_input(
                                "integration_bluesky_policy_uri",
                                "Privacy URL",
                                integrations.bluesky.policy_uri.as_deref().unwrap_or(""),
                                "https://example.com/privacy",
                            ))
                            (text_input("integration_bluesky_key_id", "New signing key ID", "", "atproto-key-1"))
                            (private_key_input("integration_bluesky_private_key", "New private key", "Paste the whole PEM file, including the BEGIN and END lines. Provide this only when adding or replacing runtime Bluesky keys."))
                        }
                    }

                    (form_actions(html! {
                        (submit_button("Save runtime integrations"))
                    }))
                }
            }
        },
    )
}
