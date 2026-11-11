// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::{
    api::{client::AdminApiClient, generated::types::BulkModerationBasis},
    middleware::{
        auth::AuthContext,
        flash::{self, FlashData},
    },
    state::AppState,
    templates::components::enforcement_fields::bulk_decision_from_form,
    utils::forms::MultiValueForm,
};
use axum::{
    extract::{Query, Request, State},
    response::{IntoResponse, Redirect, Response},
};

use super::ActionQuery;

pub(crate) async fn system_dms_post(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    request: Request,
) -> Response {
    let config = state.config();
    let base = &config.base_path;
    let form = match MultiValueForm::from_request(request).await {
        Some(form) => form,
        None => {
            return flash::redirect_error(
                config,
                &format!("{base}/system-dms"),
                "Invalid form data",
            );
        }
    };
    let client = AdminApiClient::new(state.http_client(), config, &auth.0.session);
    let user_ids = form.list_values_any(&["user_ids[]", "user_ids"]);
    let content = form.clean("content");
    let flash = if let Some(content) = content.as_deref()
        && !user_ids.is_empty()
    {
        let recipients = (user_ids != ["*"]).then_some(user_ids.as_slice());
        match client.send_system_dm(recipients, content).await {
            Ok(_) => FlashData::success("System DM sent"),
            Err(error) => {
                tracing::warn!(%error, "admin API request failed: send system DM");
                FlashData::error(error.detail_message().map_or_else(
                    || "Failed to send system DM".to_owned(),
                    |message| format!("Failed to send system DM: {message}"),
                ))
            }
        }
    } else {
        FlashData::error("Recipients and content are required")
    };
    flash::redirect_with_flash(
        &format!("{base}/system-dms"),
        flash,
        config.secure_cookies(),
    )
}

fn bulk_basis(form: &MultiValueForm) -> Result<BulkModerationBasis, String> {
    match form.first("basis") {
        Some("enforcement") => bulk_decision_from_form(form).map(BulkModerationBasis::Enforcement),
        Some("holder_request") => Ok(BulkModerationBasis::HolderRequest),
        Some("housekeeping") => Ok(BulkModerationBasis::Housekeeping),
        _ => Err("Choose a basis".to_owned()),
    }
}

pub(crate) async fn bulk_actions_post(
    State(state): State<AppState>,
    auth: axum::Extension<AuthContext>,
    Query(aq): Query<ActionQuery>,
    request: Request,
) -> Response {
    let config = state.config();
    let base = &config.base_path;
    let back = format!("{base}/bulk-actions");
    let form = match MultiValueForm::from_request(request).await {
        Some(form) => form,
        None => {
            return flash::redirect_error(config, &back, "Invalid form data");
        }
    };
    let client = AdminApiClient::new(state.http_client(), config, &auth.0.session);
    let action = aq.action.as_deref().unwrap_or("");
    let audit_log_reason = form.clean("audit_log_reason");
    let result = match action {
        "bulk-update-user-flags" => {
            let user_ids = form.list_values_any(&["user_ids[]", "user_ids"]);
            let add = form.list_values_any(&["add_flags[]", "add_flags"]);
            let remove = form.list_values_any(&["remove_flags[]", "remove_flags"]);
            client
                .bulk_update_user_flags(&user_ids, &add, &remove, audit_log_reason.as_deref())
                .await
        }
        "bulk-update-guild-features" => {
            let guild_ids = form.list_values_any(&["guild_ids[]", "guild_ids"]);
            let mut add = form.list_values_any(&["add_features[]", "add_features"]);
            add.extend(form.list_values_any(&["custom_add_features"]));
            let mut remove = form.list_values_any(&["remove_features[]", "remove_features"]);
            remove.extend(form.list_values_any(&["custom_remove_features"]));
            client
                .bulk_update_guild_features(&guild_ids, &add, &remove, audit_log_reason.as_deref())
                .await
        }
        "bulk-add-guild-members" => {
            let guild_id = form.clean("guild_id").unwrap_or_default();
            let user_ids = form.list_values_any(&["user_ids[]", "user_ids"]);
            client
                .bulk_add_guild_members(&guild_id, &user_ids, audit_log_reason.as_deref())
                .await
        }
        "bulk-schedule-user-deletion" => {
            let user_ids = form.list_values_any(&["user_ids[]", "user_ids"]);
            let basis = match bulk_basis(&form) {
                Ok(basis) => basis,
                Err(message) => return flash::redirect_error(config, &back, message),
            };
            let Ok(Some(days)) = form.parse_value::<u32>("days_until_deletion") else {
                return flash::redirect_error(config, &back, "Enter the days until deletion");
            };
            client
                .bulk_schedule_user_deletion(
                    &user_ids,
                    days,
                    basis,
                    form.clean("internal_note").as_deref(),
                )
                .await
        }
        "bulk-delete-user-messages" => {
            let user_ids = form.list_values_any(&["user_ids[]", "user_ids"]);
            let basis = match bulk_basis(&form) {
                Ok(basis) => basis,
                Err(message) => return flash::redirect_error(config, &back, message),
            };
            client
                .bulk_delete_user_messages(&user_ids, basis, form.clean("internal_note").as_deref())
                .await
        }
        _ => {
            return flash::redirect_error(config, &back, "Unknown bulk action");
        }
    };
    match result {
        Ok(response) => {
            if let Some(job_id) = response.job_id.filter(|job_id| !job_id.is_empty()) {
                Redirect::to(&format!("{base}/jobs/{job_id}")).into_response()
            } else {
                flash::redirect_with_flash(
                    &back,
                    FlashData::success("Bulk action submitted"),
                    config.secure_cookies(),
                )
            }
        }
        Err(error) => {
            tracing::warn!(%error, action, "admin API request failed: submit bulk action");
            flash::redirect_error(
                config,
                &back,
                format!("Failed to submit bulk action: {error}"),
            )
        }
    }
}
