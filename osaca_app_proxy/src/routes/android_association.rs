// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{mobile_apps, state::AppState};
use axum::{
    Json,
    extract::State,
    http::header,
    response::{IntoResponse, Response},
};

pub async fn assetlinks(State(state): State<AppState>) -> Response {
    (
        [(header::CACHE_CONTROL, "public, max-age=1800")],
        Json(mobile_apps::assetlinks(&state.config.mobile_apps)),
    )
        .into_response()
}
