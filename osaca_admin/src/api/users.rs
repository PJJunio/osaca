// SPDX-License-Identifier: AGPL-3.0-or-later

use crate::api::generated::{bool_param, user_flags};

use reqwest::Method;

use crate::api::generated::{snowflake, types as generated_types};

use crate::templates::components::enforcement_fields::BasisSubmission;

use super::client::{AdminApiClient, ApiError, ApiResult};
use super::types::{
    AdminUser, AdminUserMeResponse, GuildInfo, ListUserGuildsResponse, LookupUserResponse,
    SearchUsersResponse, TerminateSessionsResponse, UserMutationResponse,
};

impl AdminApiClient {
    pub async fn search_users(
        &self,
        query: Option<&str>,
        limit: u32,
        offset: u64,
    ) -> ApiResult<SearchUsersResponse> {
        let limit = limit.to_string();
        let offset = offset.to_string();
        let response = self
            .generated()
            .list_admin_users(
                None,
                Some(limit.as_str()),
                Some(offset.as_str()),
                nonempty(query),
                None,
                None,
            )
            .await
            .map_err(|e| self.generated_error(e))?;
        let response = response.into_inner();
        Ok(SearchUsersResponse {
            users: self.generated_value(response.users)?,
            total: crate::api::generated::number_to_u64(response.total, "total")
                .map_err(ApiError::Parse)?,
        })
    }

    pub async fn lookup_users_by_ids(&self, user_ids: &[String]) -> ApiResult<Vec<AdminUser>> {
        if user_ids.is_empty() {
            return Ok(vec![]);
        }
        let query_params: Vec<(&str, &str)> = user_ids
            .iter()
            .map(|user_id| ("user_id", user_id.as_str()))
            .collect();
        let resp: LookupUserResponse = self.get("/admin/users", Some(&query_params)).await?;
        Ok(resp.users)
    }

    pub async fn get_user_by_id(&self, user_id: &str) -> ApiResult<AdminUser> {
        let response = self
            .generated()
            .get_admin_user(&snowflake(user_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: LookupUserResponse = self.generated_value(response.into_inner())?;
        resp.users
            .into_iter()
            .next()
            .ok_or_else(|| super::client::ApiError::http(404, "User not found"))
    }

    pub async fn get_current_admin(&self) -> ApiResult<AdminUser> {
        let response = self
            .generated()
            .get_current_admin_user()
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: AdminUserMeResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn update_user_flags(
        &self,
        user_id: &str,
        add_flags: &[String],
        remove_flags: &[String],
    ) -> ApiResult<AdminUser> {
        let body = generated_types::AdminUserFlagsUpdateRequest {
            add_flags: user_flags(add_flags)?,
            remove_flags: user_flags(remove_flags)?,
        };
        let response = self
            .generated()
            .update_admin_user_flags(&snowflake(user_id), &body)
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn get_user_guilds(
        &self,
        user_id: &str,
        limit: Option<u32>,
        before: Option<&str>,
        after: Option<&str>,
        with_counts: Option<bool>,
    ) -> ApiResult<Vec<GuildInfo>> {
        let after = after.map(snowflake);
        let before = before.map(snowflake);
        let limit = limit.unwrap_or(200).to_string();
        let with_counts = bool_param(with_counts.unwrap_or(true));
        let response = self
            .generated()
            .list_admin_user_guilds(
                &snowflake(user_id),
                after.as_ref(),
                before.as_ref(),
                Some(limit.as_str()),
                Some(with_counts),
            )
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: ListUserGuildsResponse = self.generated_value(response.into_inner())?;
        Ok(resp.guilds)
    }

    pub async fn list_user_sessions(
        &self,
        user_id: &str,
    ) -> ApiResult<super::types::ListUserSessionsResponse> {
        let response = self
            .generated()
            .list_admin_user_sessions(&snowflake(user_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }

    pub async fn terminate_user_sessions(
        &self,
        user_id: &str,
    ) -> ApiResult<TerminateSessionsResponse> {
        let response = self
            .generated()
            .terminate_admin_user_sessions(&snowflake(user_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        self.generated_value(response.into_inner())
    }

    pub async fn set_user_acls(&self, user_id: &str, acls: &[String]) -> ApiResult<AdminUser> {
        let body = generated_types::AdminUserAclsRequest {
            acls: super::admin_api_keys::parse_acls(acls),
        };
        let response = self
            .generated()
            .set_admin_user_acls(&snowflake(user_id), &body)
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn set_user_traits(&self, user_id: &str, traits: &[String]) -> ApiResult<AdminUser> {
        let body = generated_types::AdminUserTraitsRequest {
            traits: traits.to_vec(),
        };
        let response = self
            .generated()
            .set_admin_user_traits(&snowflake(user_id), &body)
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn clear_user_fields(
        &self,
        user_id: &str,
        fields: &[String],
        basis: &BasisSubmission,
    ) -> ApiResult<AdminUser> {
        let fields = fields
            .iter()
            .map(|field| {
                generated_types::AdminUserClearFieldsRequestFieldsItem::try_from(field.as_str())
            })
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| ApiError::Parse(e.to_string()))?;
        let body = generated_types::AdminUserClearFieldsRequest {
            basis: basis.moderation_basis(),
            fields,
        };
        let response: UserMutationResponse = self
            .send(
                Method::DELETE,
                &format!(
                    "/admin/users/{}/profile-fields",
                    urlencoding::encode(user_id)
                ),
                Some(&body),
                basis.internal_note(),
            )
            .await?;
        Ok(response.user)
    }

    pub async fn set_bot_status(&self, user_id: &str, is_bot: bool) -> ApiResult<AdminUser> {
        let body = generated_types::AdminUserBotStatusRequest { bot: is_bot };
        let response = self
            .generated()
            .set_admin_user_bot_status(&snowflake(user_id), &body)
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn set_system_status(&self, user_id: &str, is_system: bool) -> ApiResult<AdminUser> {
        let body = generated_types::AdminUserSystemStatusRequest { system: is_system };
        let response = self
            .generated()
            .set_admin_user_system_status(&snowflake(user_id), &body)
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn change_username(
        &self,
        user_id: &str,
        username: &str,
        discriminator: Option<&str>,
    ) -> ApiResult<AdminUser> {
        let body = generated_types::AdminUserUsernameUpdateRequest {
            discriminator: discriminator
                .map(|value| generated_types::DiscriminatorType::String(value.to_owned())),
            username: generated_types::UsernameType::from(username.to_owned()),
        };
        let response = self
            .generated()
            .update_admin_user_username(&snowflake(user_id), &body)
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn unban_user(
        &self,
        user_id: &str,
        private_reason: Option<&str>,
    ) -> ApiResult<AdminUser> {
        let response = self
            .generated_with_reason(private_reason)?
            .unban_admin_user(&snowflake(user_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }

    pub async fn cancel_deletion(
        &self,
        user_id: &str,
        expected_pending_deletion_at: &str,
        audit_log_reason: Option<&str>,
    ) -> ApiResult<AdminUser> {
        let body = serde_json::json!({
            "expected_pending_deletion_at": expected_pending_deletion_at,
        });
        let resp: UserMutationResponse = self
            .send(
                Method::DELETE,
                &format!("/admin/users/{}/deletion", urlencoding::encode(user_id)),
                Some(&body),
                audit_log_reason,
            )
            .await?;
        Ok(resp.user)
    }

    pub async fn cancel_bulk_message_deletion(&self, user_id: &str) -> ApiResult<AdminUser> {
        let response = self
            .generated()
            .cancel_admin_user_message_deletion(&snowflake(user_id))
            .await
            .map_err(|e| self.generated_error(e))?;
        let resp: UserMutationResponse = self.generated_value(response.into_inner())?;
        Ok(resp.user)
    }
}

fn nonempty(value: Option<&str>) -> Option<&str> {
    value.filter(|value| !value.is_empty())
}
