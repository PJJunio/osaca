// SPDX-License-Identifier: AGPL-3.0-or-later

use axum::{
    Json,
    http::header,
    response::{IntoResponse, Response},
};
use serde_json::json;

pub async fn apple_app_site_association() -> Response {
    let body = json!({
        "webcredentials": {
            "apps": [
                "3G5837T29K.app.osaca",
                "3G5837T29K.app.osaca.canary",
                "3G5837T29K.com.osaca",
                "3G5837T29K.com.osaca.canary"
            ]
        }
    });

    (
        [(header::CACHE_CONTROL, "public, max-age=1800")],
        Json(body),
    )
        .into_response()
}
