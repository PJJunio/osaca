// SPDX-License-Identifier: AGPL-3.0-or-later

//! Fixtures shared by the template render tests.

use crate::{
    api::types::AdminUser,
    config::{AdminConfig, ProxyConfig},
    middleware::auth::AuthContext,
    session::Session,
};

pub fn config() -> AdminConfig {
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
        build_version: String::new(),
        self_hosted: true,
        proxy: ProxyConfig {
            trust_client_ip_header: false,
            client_ip_header_name: String::new(),
        },
    }
}

/// An Operator signed in with every admin ACL.
pub fn auth() -> AuthContext {
    let admin_user: AdminUser = serde_json::from_value(serde_json::json!({
        "id": "1",
        "username": "operator",
        "discriminator": "0001",
        "acls": [crate::acl::WILDCARD],
    }))
    .expect("fixture admin user");
    AuthContext {
        session: Session {
            user_id: "1".to_owned(),
            access_token: String::new(),
            created_at: 0,
        },
        admin_user: Some(admin_user),
        pending_registration_count: None,
        branding: None,
    }
}

/// Every value of `attribute` in the rendered markup, in order.
pub fn attribute_values<'a>(html: &'a str, attribute: &str) -> Vec<&'a str> {
    html.split(&format!(" {attribute}=\""))
        .skip(1)
        .filter_map(|rest| rest.split('"').next())
        .collect()
}
