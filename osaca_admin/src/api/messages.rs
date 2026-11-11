// SPDX-License-Identifier: AGPL-3.0-or-later

use reqwest::Method;

use crate::api::generated::{snowflake, types as generated_types};

use crate::templates::components::enforcement_fields::BasisSubmission;

use super::client::{AdminApiClient, ApiResult};
use super::types::MessageShredStatusResponse;

impl AdminApiClient {
    pub async fn preview_message_shred(
        &self,
        user_id: &str,
        entries: Vec<generated_types::AdminUserMessageShredPreviewRequestEntriesItem>,
    ) -> ApiResult<generated_types::MessageShredPreviewResponse> {
        let body = generated_types::AdminUserMessageShredPreviewRequest { entries };
        self.send(
            Method::POST,
            &format!(
                "/admin/users/{}/message-shreds/preview",
                urlencoding::encode(user_id)
            ),
            Some(&body),
            None,
        )
        .await
    }

    pub async fn queue_message_shred(
        &self,
        user_id: &str,
        entries: Vec<generated_types::AdminUserMessageShredRequestEntriesItem>,
        basis: &BasisSubmission,
        preview_token: generated_types::AdminUserMessageShredRequestPreviewToken,
    ) -> ApiResult<generated_types::MessageShredResponse> {
        let body = generated_types::AdminUserMessageShredRequest {
            basis: basis.moderation_basis(),
            entries,
            preview_token: Some(preview_token),
        };
        self.send(
            Method::POST,
            &format!(
                "/admin/users/{}/message-shreds",
                urlencoding::encode(user_id)
            ),
            Some(&body),
            basis.internal_note(),
        )
        .await
    }

    pub async fn delete_all_user_messages(
        &self,
        user_id: &str,
        basis: Option<&BasisSubmission>,
    ) -> ApiResult<generated_types::DeleteAllUserMessagesResponse> {
        let body = generated_types::AdminUserMessageDeleteRequest {
            basis: basis.map(BasisSubmission::moderation_basis),
        };
        let dry_run = if basis.is_some() { "false" } else { "true" };
        self.send(
            Method::DELETE,
            &format!(
                "/admin/users/{}/messages?dry_run={dry_run}",
                urlencoding::encode(user_id)
            ),
            Some(&body),
            basis.and_then(BasisSubmission::internal_note),
        )
        .await
    }

    pub async fn get_message_shred_status(
        &self,
        job_id: &str,
    ) -> ApiResult<MessageShredStatusResponse> {
        let response = self
            .generated()
            .get_admin_message_shred(&snowflake(job_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }
}
