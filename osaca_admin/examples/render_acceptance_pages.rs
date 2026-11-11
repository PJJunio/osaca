// SPDX-License-Identifier: AGPL-3.0-or-later

//! Renders representative admin pages with fixed data so the redesign can be checked in a browser
//! without an API or database (issue #45, docs/redesign-validation.md).
//!
//! Usage: `cargo run -p osaca_admin --example render_acceptance_pages -- <out-dir>`
//! then serve `<out-dir>` with the compiled `app.css` and fonts under `<out-dir>/admin/static/`.

use std::{fs, path::PathBuf};

use maud::Markup;
use osaca_admin::{
    api::types::{AdminUser, FlashLevel, FlashMessage},
    config::{AdminConfig, ProxyConfig},
    middleware::auth::AuthContext,
    session::Session,
    templates::{
        components::{empty_state::not_found_state, error_display::error_alert},
        layout::admin_layout,
        pages::{
            bulk_actions::bulk_actions_page,
            login::login_page,
            system_dm::{SystemDmParams, system_dm_page},
            users_list::{
                UserListOutput, UserListParams, UserListResults, UserListView, users_list_page,
            },
        },
    },
};

fn config() -> AdminConfig {
    AdminConfig {
        host: "127.0.0.1".to_owned(),
        port: 0,
        secret_key_base: String::new(),
        base_path: "/admin".to_owned(),
        api_endpoint: String::new(),
        api_public_endpoint: String::new(),
        media_endpoint: String::new(),
        static_cdn_endpoint: String::new(),
        reports_bucket_origin: String::new(),
        admin_endpoint: String::new(),
        web_app_endpoint: String::new(),
        oauth_client_id: String::new(),
        oauth_client_secret: String::new(),
        oauth_redirect_uri: String::new(),
        build_version: "acceptance".to_owned(),
        self_hosted: true,
        proxy: ProxyConfig {
            trust_client_ip_header: false,
            client_ip_header_name: String::new(),
        },
    }
}

fn user(id: &str, username: &str, acls: &[&str]) -> AdminUser {
    serde_json::from_value(serde_json::json!({
        "id": id,
        "username": username,
        "discriminator": "0001",
        "acls": acls,
        "last_active_at": "2026-11-10T12:00:00Z",
    }))
    .expect("fixture user")
}

fn auth() -> AuthContext {
    AuthContext {
        session: Session {
            user_id: "1".to_owned(),
            access_token: String::new(),
            created_at: 0,
        },
        admin_user: Some(user("1", "operator", &["*"])),
        pending_registration_count: Some(3),
        branding: None,
    }
}

fn main() {
    let out = PathBuf::from(
        std::env::args()
            .nth(1)
            .expect("usage: render_acceptance_pages <out-dir>"),
    );
    fs::create_dir_all(&out).expect("create out dir");
    let config = config();
    let auth = auth();
    let csrf = "acceptance";

    let params = UserListParams::from_query(None, None, None, None);
    let users = [
        user("2", "quiet-heron", &[]),
        user("3", "night-owl", &["user:lookup"]),
    ];
    let success = FlashMessage {
        level: FlashLevel::Success,
        message: "Bulk action queued.".to_owned(),
    };

    let pages: Vec<(&str, Markup)> = vec![
        ("login", login_page(&config, None, None)),
        (
            "login-error",
            login_page(&config, None, Some("Your session expired. Sign in again.")),
        ),
        (
            "users",
            users_list_page(
                &config,
                &auth,
                UserListView {
                    params: &params,
                    results: Some(UserListResults {
                        users: &users,
                        has_more: false,
                        total: Some(2),
                    }),
                    output: UserListOutput::Page,
                },
            ),
        ),
        (
            "users-empty",
            users_list_page(
                &config,
                &auth,
                UserListView {
                    params: &params,
                    results: Some(UserListResults {
                        users: &[],
                        has_more: false,
                        total: Some(0),
                    }),
                    output: UserListOutput::Page,
                },
            ),
        ),
        (
            "system-dms",
            system_dm_page(
                &config,
                &auth,
                &SystemDmParams {
                    form_error: None,
                    csrf_token: csrf,
                },
            ),
        ),
        (
            "system-dms-error",
            system_dm_page(
                &config,
                &auth,
                &SystemDmParams {
                    form_error: Some("Recipients and content are required"),
                    csrf_token: csrf,
                },
            ),
        ),
        ("bulk-actions", bulk_actions_page(&config, &auth, csrf)),
        (
            "success",
            admin_layout(
                &config,
                &auth,
                "Bulk Actions",
                "bulk-actions",
                Some(&success),
                maud::html! {},
            ),
        ),
        (
            "error",
            admin_layout(
                &config,
                &auth,
                "Error",
                "users",
                None,
                error_alert("Could not load this page."),
            ),
        ),
        (
            "not-found",
            admin_layout(
                &config,
                &auth,
                "User",
                "users",
                None,
                not_found_state("User", "404", Some("/admin/users"), Some("Back to users")),
            ),
        ),
    ];

    for (name, markup) in pages {
        let path = out.join(format!("{name}.html"));
        fs::write(&path, markup.into_string()).expect("write page");
        println!("{}", path.display());
    }
}
