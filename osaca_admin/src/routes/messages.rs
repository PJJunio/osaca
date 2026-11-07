// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    middleware::{auth::AuthContext, csrf::CsrfToken},
    state::AppState,
    templates,
};
use axum::{
    Router,
    extract::State,
    response::{Html, IntoResponse, Response},
    routing::get,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/system-dms",
            get(system_dms_page).post(super::message_actions::system_dms_post),
        )
        .route(
            "/bulk-actions",
            get(bulk_actions_page).post(super::message_actions::bulk_actions_post),
        )
}

async fn system_dms_page(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    csrf: axum::Extension<CsrfToken>,
) -> Response {
    let config = state.config();
    let markup = templates::pages::system_dm::system_dm_page(
        config,
        &auth.0,
        &templates::pages::system_dm::SystemDmParams {
            form_error: None,
            csrf_token: &csrf.0.0,
        },
    );
    Html(markup.into_string()).into_response()
}

async fn bulk_actions_page(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    csrf: axum::Extension<CsrfToken>,
) -> Response {
    let config = state.config();
    let markup = templates::pages::bulk_actions::bulk_actions_page(config, &auth.0, &csrf.0.0);
    Html(markup.into_string()).into_response()
}
