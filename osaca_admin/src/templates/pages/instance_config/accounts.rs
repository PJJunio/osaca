// SPDX-License-Identifier: AGPL-3.0-or-later

use super::{
    CLEANUP_MODE_CHOICES, GUILD_JOIN_GATE_CHOICES, INTERACTION_TIER_CHOICES,
    LAST_SESSION_CLEANUP_CHOICES, choice_select,
};
use crate::templates::pages::instance_config::ConfigForm;
use crate::{
    api::types::{
        AccountsConfigResponse, AuthConfigResponse, CLEANUP_INACTIVE_DAYS_RANGE, CaptchaProvider,
        GuildJoinGate, INSTANT_ACCOUNTS_ESCALATION_RANGE, InstantAccountAvailability,
        InteractionTierMode, SCHEDULED_DELETION_GRACE_HOURS,
    },
    templates::components::{
        badge::{BadgeVariant, badge},
        form::{Checkbox, NumberField, form_actions, submit_button},
        section_card::section_card_with_description,
    },
};
use maud::{Markup, html};

const MISSING_CREDENTIAL: &str = "without a password or passkey";

fn instant_account_inactive_reason(
    availability: InstantAccountAvailability,
) -> Option<&'static str> {
    match availability {
        InstantAccountAvailability::Available | InstantAccountAvailability::Disabled => None,
        InstantAccountAvailability::CaptchaOff => Some("Inactive: the proof-of-work check is off"),
        InstantAccountAvailability::RegistrationClosed => Some("Inactive: registration is closed"),
        InstantAccountAvailability::ApprovalRequired => {
            Some("Inactive: new accounts need approval")
        }
    }
}

fn guild_join_gate_inactive_reason(
    accounts: &AccountsConfigResponse,
    guild_visits_enabled: bool,
) -> Option<&'static str> {
    if accounts.guild_join_gate == GuildJoinGate::Off {
        None
    } else if accounts.interaction_tier == InteractionTierMode::Legacy {
        Some("Inactive: the older limits are on")
    } else if !guild_visits_enabled {
        Some("Inactive: community previews are off")
    } else {
        None
    }
}

fn days_field(
    name: &str,
    label: &str,
    value: u64,
    range: &std::ops::RangeInclusive<u32>,
) -> Markup {
    NumberField {
        name,
        label,
        value: &value.to_string(),
        min: Some(*range.start()),
        max: Some(*range.end()),
        step: "1",
        helper: None,
        placeholder: None,
    }
    .render()
}

pub(super) struct AccountsSectionInput<'a> {
    pub(super) auth: &'a AuthConfigResponse,
    pub(super) accounts: &'a AccountsConfigResponse,
    pub(super) captcha_provider: CaptchaProvider,
    pub(super) guild_visits_enabled: bool,
}

pub(super) fn accounts_section(
    base: &str,
    config_form: ConfigForm<'_>,
    input: &AccountsSectionInput,
) -> Markup {
    let AccountsSectionInput {
        auth,
        accounts,
        captcha_provider,
        guild_visits_enabled,
    } = *input;
    let captcha_on = captcha_provider != CaptchaProvider::None;
    let instant_inactive = auth
        .instant_accounts
        .enabled
        .then(|| instant_account_inactive_reason(auth.instant_account_availability))
        .flatten();
    let join_gate_inactive = guild_join_gate_inactive_reason(accounts, guild_visits_enabled);
    let interaction_tier_label = format!("Accounts {MISSING_CREDENTIAL}");
    let unclaimed = &accounts.unclaimed_account_cleanup;
    section_card_with_description(
        "Sign-in & new accounts",
        &format!(
            "Whether people can start with just a display name, and what an account \
             {MISSING_CREDENTIAL} can do."
        ),
        html! {
            form method="post" action={(base) "/instance-config?action=update_accounts"} {
                (config_form.fields())
                div class="space-y-6" {
                    div class="flex flex-wrap items-center gap-2" {
                        (Checkbox {
                            name: "auth_instant_accounts_enabled",
                            value: "true",
                            label: "Let people start with just a display name",
                            checked: auth.instant_accounts.enabled,
                            enabled: captcha_on || auth.instant_accounts.enabled,
                        }.render())
                        @if let Some(reason) = instant_inactive {
                            (badge(reason, BadgeVariant::Warning))
                        }
                    }
                    p class="text-xs text-neutral-500" {
                        @if captcha_on {
                            "New people type the name others see and start right away. Their username \
                             is made from it, and they set a password later to keep the account. This \
                             works while registration is open, or through a registration link that \
                             does not need approval."
                        } @else {
                            "Turn on the proof-of-work check first. Instant accounts need it."
                        }
                    }
                    (NumberField {
                        name: "auth_instant_accounts_pow_escalation_per_hour",
                        label: "Accounts per hour before the check gets harder",
                        value: &auth.instant_accounts.pow_escalation_per_hour.to_string(),
                        min: Some(*INSTANT_ACCOUNTS_ESCALATION_RANGE.start()),
                        max: Some(*INSTANT_ACCOUNTS_ESCALATION_RANGE.end()),
                        step: "1",
                        helper: Some("Every this many instant accounts in the current hour doubles the check's cost for the next one."),
                        placeholder: None,
                    }.render())
                    (choice_select(
                        "accounts_interaction_tier",
                        &interaction_tier_label,
                        INTERACTION_TIER_CHOICES,
                        &accounts.interaction_tier,
                    ))
                    div class="flex flex-col gap-2" {
                        (choice_select(
                            "accounts_guild_join_gate",
                            &format!("Joining a community {MISSING_CREDENTIAL}"),
                            GUILD_JOIN_GATE_CHOICES,
                            &accounts.guild_join_gate,
                        ))
                        @if let Some(reason) = join_gate_inactive {
                            div { (badge(reason, BadgeVariant::Warning)) }
                        }
                    }
                    p class="text-xs text-neutral-500" {
                        (format!(
                            "Applies only while \u{201c}{interaction_tier_label}\u{201d} is set to \
                             \u{201c}Only allow what does not reach other people\u{201d} and community \
                             previews are on for that person."
                        ))
                    }
                    div class="space-y-4 border-t border-neutral-200 pt-6" {
                        h3 class="text-sm font-semibold text-neutral-900" { "Accounts with no way back in" }
                        div class="grid grid-cols-1 gap-4 sm:grid-cols-3" {
                            (choice_select(
                                "accounts_unclaimed_cleanup_mode",
                                "Delete",
                                CLEANUP_MODE_CHOICES,
                                &unclaimed.mode,
                            ))
                            (days_field(
                                "accounts_unclaimed_cleanup_inactive_days",
                                "Days without use",
                                unclaimed.inactive_days.get(),
                                &CLEANUP_INACTIVE_DAYS_RANGE,
                            ))
                            (choice_select(
                                "accounts_unclaimed_cleanup_on_last_session_end",
                                "After the last sign-out",
                                LAST_SESSION_CLEANUP_CHOICES,
                                &unclaimed.on_last_session_end,
                            ))
                        }
                        p class="text-xs text-neutral-500" {
                            (format!(
                                "An account has no way back in when it has none of a password, a passkey \
                                 or a recovery kit. Such an account is deleted after {} days without use. \
                                 Deletion after the last sign-out happens {SCHEDULED_DELETION_GRACE_HOURS} \
                                 hours after it signs out of its last session.",
                                unclaimed.inactive_days,
                            ))
                        }
                    }
                    (form_actions(html! {
                        (submit_button("Save"))
                    }))
                }
            }
        },
    )
}
