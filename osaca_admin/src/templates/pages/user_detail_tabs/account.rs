// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    api::{
        generated::types::EnforcementKindType,
        types::{AdminUser, UserSession},
    },
    config::AdminConfig,
    templates::components::{
        enforcement_fields::{BasisFields, DecisionFields, FIELD_HELP_CLASS, basis_fields},
        form::{Checkbox, csrf_input, form_actions, submit_button},
        page_container::card_with_header,
    },
    utils::timestamps::format_admin_timestamp,
};
use maud::{Markup, html};

const INPUT_CLS: &str = "block w-full rounded-md border border-neutral-300 px-3 py-2 \
                          text-sm shadow-sm focus:border-osaca-focus focus:outline-none \
                          focus:ring-1 focus:ring-osaca-focus";
const BTN_CLS: &str = "w-full inline-flex items-center justify-center rounded-md \
                        bg-brand-primary px-4 py-2 text-sm font-medium text-white \
                        shadow-sm hover:bg-brand-primary-dark";

pub fn account_tab(
    config: &AdminConfig,
    user: &AdminUser,
    sessions: &[UserSession],
    csrf_token: &str,
) -> Markup {
    let base = &config.base_path;
    html! {
        div class="space-y-6" {
            (edit_account_card(base, user, csrf_token))
            (sessions_card(sessions))
            (clear_fields_card(base, user, csrf_token))
            (user_status_card(base, user, csrf_token))
            (security_actions_card(base, user, csrf_token))
        }
    }
}

fn edit_account_card(base: &str, user: &AdminUser, csrf_token: &str) -> Markup {
    html! {
        (card_with_header("Edit Account Information", html! {
            div class="grid gap-4 md:grid-cols-2" {
                (post_form(base, &user.id, "change_username", "account", html! {
                    p class="text-sm font-medium text-neutral-700" { "Change Username:" }
                    input type="text" name="username" placeholder="New username"
                        required class=(INPUT_CLS);
                    @if user.bot {
                        input type="text" name="discriminator"
                            placeholder="Discriminator (optional)" inputmode="numeric" pattern="[0-9]{1,4}" maxlength="4"
                            class=(INPUT_CLS);
                    }
                    (form_actions(html! {
                        (submit_button("Change Username"))
                    }))
                }, csrf_token))
            }
        }))
    }
}

fn sessions_card(sessions: &[UserSession]) -> Markup {
    let active: Vec<_> = sessions.iter().filter(|s| s.deleted_at.is_none()).collect();
    let terminated: Vec<_> = sessions.iter().filter(|s| s.deleted_at.is_some()).collect();
    html! {
        (card_with_header("Sessions", html! {
            @if sessions.is_empty() {
                p class="text-sm text-neutral-500" { "No sessions" }
            } @else {
                div class="space-y-3" {
                    @if !active.is_empty() {
                        p class="text-xs font-medium uppercase tracking-wide text-neutral-500" { "Active" }
                    }
                    @for s in &active {
                        (session_entry(s))
                    }
                    @if !terminated.is_empty() {
                        p class="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-400" { "Terminated" }
                    }
                    @for s in &terminated {
                        (session_entry(s))
                    }
                }
            }
        }))
    }
}

fn session_entry(s: &UserSession) -> Markup {
    let is_tombstone = s.deleted_at.is_some();
    let border_cls = if is_tombstone {
        "rounded-lg border border-neutral-200 bg-neutral-100/60 p-4 opacity-75"
    } else {
        "rounded-lg border border-neutral-200 bg-neutral-50 p-4"
    };
    html! {
        div class=(border_cls) {
            div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3" {
                (meta_cell("Session ID", html! {
                    span class="text-xs" { (s.session_id_hash) }
                    @if is_tombstone {
                        span class="ml-2 inline-flex items-center rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-600" { "Terminated" }
                    }
                }))
                (meta_cell("Created", html! { (format_admin_timestamp(&s.created_at)) }))
                @if let Some(ref d) = s.deleted_at {
                    (meta_cell("Terminated", html! { (format_admin_timestamp(d)) }))
                } @else {
                    (meta_cell("Last Used", html! { (format_admin_timestamp(&s.approx_last_used_at)) }))
                }
                @if let Some(ref p) = s.client_platform {
                    (meta_cell("Platform", html! { (p) }))
                }
                @if let Some(ref o) = s.client_os {
                    (meta_cell("OS", html! { (o) }))
                }
                @if let Some(app) = session_app_label(s) {
                    (meta_cell("App", html! { (app) }))
                }
            }
        }
    }
}

fn session_app_label(s: &UserSession) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(ref version) = s.app_version {
        parts.push(version.clone());
    }
    if let Some(build) = s.app_build_number {
        parts.push(format!("build {build}"));
    }
    match (s.app_release_channel.as_deref(), s.app_beta_number) {
        (Some(channel), Some(beta)) => parts.push(format!("{channel} {beta}")),
        (Some(channel), None) => parts.push(channel.to_owned()),
        (None, _) => {}
    }
    (!parts.is_empty()).then(|| parts.join(", "))
}

fn clear_fields_card(base: &str, user: &AdminUser, csrf_token: &str) -> Markup {
    let has = user.avatar.is_some()
        || user.banner.is_some()
        || user.bio.is_some()
        || user.pronouns.is_some()
        || user.global_name.is_some();
    if !has {
        return html! {};
    }
    let action_url = format!("{base}/users/{}?action=clear_fields&tab=account", user.id);
    html! {
        (card_with_header("Clear profile fields", html! {
            form method="post"
                action=(&action_url)
                hx-post=(&action_url)
                hx-target="#flash-container"
                hx-swap="none"
                hx-push-url="false" {
                (csrf_input(csrf_token))
                div class="space-y-4" {
                    div class="grid grid-cols-2 gap-3 md:grid-cols-3" {
                        @if user.avatar.is_some() { (Checkbox {
                            name: "fields[]",
                            value: "avatar",
                            label: "Avatar",
                            checked: false,
                            enabled: true,
                        }.render()) }
                        @if user.banner.is_some() { (Checkbox {
                            name: "fields[]",
                            value: "banner",
                            label: "Banner",
                            checked: false,
                            enabled: true,
                        }.render()) }
                        @if user.bio.is_some() { (Checkbox {
                            name: "fields[]",
                            value: "bio",
                            label: "Bio",
                            checked: false,
                            enabled: true,
                        }.render()) }
                        @if user.pronouns.is_some() { (Checkbox {
                            name: "fields[]",
                            value: "pronouns",
                            label: "Pronouns",
                            checked: false,
                            enabled: true,
                        }.render()) }
                        @if user.global_name.is_some() { (Checkbox {
                            name: "fields[]",
                            value: "global_name",
                            label: "Display name",
                            checked: false,
                            enabled: true,
                        }.render()) }
                    }
                    (basis_fields(&BasisFields {
                        decision: DecisionFields {
                            id_prefix: "clear-fields",
                            kind: EnforcementKindType::ProfileReset,
                            report_ids: &[],
                            messages: Some(&[]),
                            user_flags: Some(user.flags),
                            allow_restricted: true,
                        },
                        choices: &[
                            ("enforcement", "A rule was broken"),
                            ("holder_request", "The account holder asked"),
                            ("housekeeping", "Housekeeping"),
                        ],
                        plain_note_help: "Staff only. Saved in the audit log.",
                        enforcement_extra: html! {
                            p class=(FIELD_HELP_CLASS) {
                                "The current values are saved as evidence before they are cleared. The cleared fields are the facts, so evidence and a note to the user are optional."
                            }
                        },
                    }))
                    (form_actions(html! {
                        (submit_button("Clear selected fields"))
                    }))
                }
            }
        }))
    }
}

fn user_status_card(base: &str, user: &AdminUser, csrf_token: &str) -> Markup {
    html! {
        (card_with_header("User Status", html! {
            div class="grid grid-cols-1 gap-4 md:grid-cols-2" {
                (status_toggle(base, user, UserStatus::Bot, csrf_token))
                (status_toggle(base, user, UserStatus::System, csrf_token))
            }
        }))
    }
}

fn security_actions_card(base: &str, user: &AdminUser, csrf_token: &str) -> Markup {
    html! {
        (card_with_header("Security Actions", html! {
            div class="grid grid-cols-1 gap-3 md:grid-cols-2" {
                (action_form(base, &user.id, "terminate_sessions", "account",
                    "Terminate All Sessions", csrf_token))
            }
        }))
    }
}

fn meta_cell(label: &str, value: Markup) -> Markup {
    html! { div { p class="text-sm font-medium text-neutral-500" { (label) } p class="text-sm text-neutral-900" { (value) } } }
}

fn post_form(base: &str, uid: &str, action: &str, tab: &str, body: Markup, csrf: &str) -> Markup {
    let action_url = format!("{base}/users/{uid}?action={action}&tab={tab}");
    html! {
        form method="post"
            action=(&action_url)
            hx-post=(&action_url)
            hx-target="#flash-container"
            hx-swap="none"
            hx-push-url="false"
            class="w-full" {
            (csrf_input(csrf))
            div class="space-y-2" { (body) }
        }
    }
}

fn action_form(base: &str, uid: &str, action: &str, tab: &str, label: &str, csrf: &str) -> Markup {
    let action_url = format!("{base}/users/{uid}?action={action}&tab={tab}");
    html! {
        form method="post"
            action=(&action_url)
            hx-post=(&action_url)
            hx-target="#flash-container"
            hx-swap="none"
            hx-push-url="false" {
            (csrf_input(csrf))
            button type="submit" class=(BTN_CLS) { (label) }
        }
    }
}

enum UserStatus {
    Bot,
    System,
}

fn status_toggle(base: &str, user: &AdminUser, status: UserStatus, csrf: &str) -> Markup {
    let (active, action, kind, title) = match status {
        UserStatus::Bot => (user.bot, "set_bot_status", "bot", "Bot"),
        UserStatus::System => (user.system, "set_system_status", "system", "System"),
    };
    let uid = &user.id;
    let status_val = if active { "false" } else { "true" };
    let label = format!("{} {} Status", if active { "Remove" } else { "Set" }, title);
    let action_url = format!("{base}/users/{uid}?action={action}&status={status_val}&tab=account");
    html! {
        form method="post"
            action=(&action_url)
            hx-post=(&action_url)
            hx-target="#flash-container"
            hx-swap="none"
            hx-push-url="false" {
            (csrf_input(csrf))
            input type="hidden" name=(kind) value=(status_val);
            button type="submit" class=(BTN_CLS) { (label) }
        }
    }
}
