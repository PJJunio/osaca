// SPDX-License-Identifier: AGPL-3.0-or-later

import {requireSudoMode, type SudoVerificationResult} from '@app/api/auth/services/SudoVerificationService';
import {createChannelID, createGuildID, type UserID} from '@app/api/BrandedTypes';
import type {UserConnectionRow} from '@app/api/database/types/ConnectionTypes';
import type {ThreadViewer} from '@app/api/experiment/ChannelThreadsGate';
import {emitActivity} from '@app/api/infrastructure/activity/ActivityEvents';
import type {UserCacheService} from '@app/api/infrastructure/UserCacheService';
import type {RequestCache} from '@app/api/middleware/RequestCacheMiddleware';
import type {AuthSession} from '@app/api/models/AuthSession';
import type {User} from '@app/api/models/User';
import type {AuthTokenType, HonoEnv} from '@app/api/types/HonoEnv';
import {assertAccountNotLimited} from '@app/api/user/AccountLimit';
import {
	evaluateTierGateFor,
	getAccountTier,
	isInteractionTierEnforced,
	NO_TIER_CONTEXT,
	tierDenialError,
} from '@app/api/user/AccountTier';
import {isProfileHidden} from '@app/api/user/ProfileVisibility';
import {resolveHiddenProfileBadges} from '@app/api/user/profile_badges/HiddenProfileBadges';
import {buildOwnProfileBadges, buildProfileBadges} from '@app/api/user/profile_badges/ProfileBadgeBuilder';
import {loadProfileBadgeEnvironment} from '@app/api/user/profile_badges/ProfileBadgeEnvironment';
import type {UserAccountService} from '@app/api/user/services/UserAccountService';
import type {UserChannelService} from '@app/api/user/services/UserChannelService';

import {
	mapGuildMemberToProfileResponse,
	mapUserToPrivateResponse,
	mapUserToProfileResponse,
} from '@app/api/user/UserMappers';
import {AccountTiers, TierGatedActions} from '@osaca/constants/src/AccountTierConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {getCurrentTimeZoneOffsetMinutes} from '@osaca/date_utils/src/TimeZoneUtils';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import {UnauthorizedError} from '@osaca/errors/src/domains/core/UnauthorizedError';
import type {ConnectionResponse} from '@osaca/schema/src/domains/connection/ConnectionSchemas';
import type {
	ProfileBadgePreviewRequest,
	ProfileBadgePreviewResponse,
} from '@osaca/schema/src/domains/user/ProfileBadgeSchemas';
import type {UserUpdateWithVerificationRequest} from '@osaca/schema/src/domains/user/UserRequestSchemas';
import type {
	UserPrivateResponse,
	UserProfileFullResponse,
	UserUpdateResponse,
} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import type {Context} from 'hono';

type UserUpdatePayload = Omit<
	UserUpdateWithVerificationRequest,
	'mfa_method' | 'mfa_code' | 'webauthn_response' | 'webauthn_challenge'
>;

const PROFILE_CUSTOMIZATION_FIELDS: ReadonlyArray<keyof UserUpdatePayload> = [
	'username',
	'discriminator',
	'global_name',
	'avatar',
	'banner',
	'bio',
	'pronouns',
	'accent_color',
	'timezone',
	'timezone_privacy_flags',
	'hidden_profile_badges',
];

function hasProfileCustomizationUpdate(data: UserUpdatePayload): boolean {
	return PROFILE_CUSTOMIZATION_FIELDS.some((field) => data[field] !== undefined);
}

function hasDefinedUserUpdatePayload(data: UserUpdatePayload): boolean {
	return Object.values(data).some((value) => value !== undefined);
}

function profileFieldsChanged(before: User, after: User): boolean {
	return (
		before.username !== after.username ||
		before.globalName !== after.globalName ||
		before.bio !== after.bio ||
		before.avatarHash !== after.avatarHash ||
		before.pronouns !== after.pronouns
	);
}

interface UserProfileParams {
	currentUserId: UserID;
	targetUserId: UserID;
	guildId?: bigint;
	withMutualFriends?: boolean;
	withMutualGuilds?: boolean;
	requestCache: RequestCache;
	requestLocale: string;
}

export class UserAccountRequestService {
	constructor(
		private readonly userAccountService: UserAccountService,
		private readonly userChannelService: UserChannelService,
		private readonly userCacheService: UserCacheService,
	) {}

	async getCurrentUserResponse(params: {
		authTokenType?: AuthTokenType;
		oauthBearerScopes?: Set<string> | null;
		user?: User;
	}): Promise<UserPrivateResponse> {
		const tokenType = params.authTokenType;
		if (tokenType === 'bearer') {
			const bearerUser = params.user;
			if (!bearerUser) {
				throw new UnauthorizedError();
			}
			const response = mapUserToPrivateResponse(bearerUser);
			this.stripBearerSensitiveFields(response);
			return response;
		}
		const user = params.user;
		if (user) {
			return mapUserToPrivateResponse(user);
		}
		throw new UnauthorizedError();
	}

	async updateCurrentUser(params: {
		ctx: Context<HonoEnv>;
		user: User;
		body: UserUpdateWithVerificationRequest;
		authSession: AuthSession;
	}): Promise<UserUpdateResponse> {
		const {ctx, body, authSession} = params;
		const {user} = params;
		const {
			mfa_method: _mfaMethod,
			mfa_code: _mfaCode,
			webauthn_response: _webauthnResponse,
			webauthn_challenge: _webauthnChallenge,
			...userUpdateDataRest
		} = body;
		const userUpdateData: UserUpdatePayload = userUpdateDataRest;
		if (!hasDefinedUserUpdatePayload(userUpdateData)) {
			return mapUserToPrivateResponse(user);
		}
		const isUnclaimed = getAccountTier(user) === AccountTiers.UNCLAIMED;
		if (
			!isUnclaimed &&
			userUpdateData.new_password !== undefined &&
			!userUpdateData.password &&
			user.passwordHash !== null
		) {
			throw InputValidationError.fromCode('password', ValidationErrorCodes.PASSWORD_NOT_SET);
		}
		const profileCustomization = hasProfileCustomizationUpdate(userUpdateData);
		const profileGate = evaluateTierGateFor(user, TierGatedActions.PROFILE_CUSTOMIZE, NO_TIER_CONTEXT);
		if (isUnclaimed && !profileGate.allowed) {
			const allowed = new Set(['new_password']);
			if (userUpdateData.new_password !== undefined) {
				allowed.add('username');
			}
			const disallowedField = Object.keys(userUpdateData).find((key) => !allowed.has(key));
			if (disallowedField) {
				throw InputValidationError.fromCode(
					disallowedField,
					ValidationErrorCodes.UNCLAIMED_ACCOUNTS_CAN_ONLY_SET_EMAIL_VIA_TOKEN,
					{need: profileGate.need},
				);
			}
		} else if (profileCustomization && !profileGate.allowed) {
			throw tierDenialError(profileGate);
		}
		if (profileCustomization) assertAccountNotLimited(user);
		const needsVerification = this.requiresSensitiveUserVerification(user, userUpdateData);
		let sudoResult: SudoVerificationResult | null = null;
		if (needsVerification) {
			sudoResult = await requireSudoMode(ctx, user, body);
		}
		const {user: updatedUser, authSessionReplacement} = await this.userAccountService.update({
			user,
			oldAuthSession: authSession,
			data: userUpdateData,
			request: ctx.req.raw,
			sudoContext: sudoResult ?? undefined,
		});
		if (profileFieldsChanged(user, updatedUser)) {
			await emitActivity('profile_updated', updatedUser.id.toString(), {
				user_id: updatedUser.id.toString(),
				username: updatedUser.username,
				global_name: updatedUser.globalName,
				bio: updatedUser.bio,
				avatar_hash: updatedUser.avatarHash,
				pronouns: updatedUser.pronouns,
			});
		}
		const response = mapUserToPrivateResponse(updatedUser);
		if (!authSessionReplacement) {
			return response;
		}
		return {
			...response,
			token: authSessionReplacement.token,
			auth_session_id_hash: authSessionReplacement.authSessionIdHash,
		};
	}

	async preloadMessages(params: {
		userId: UserID;
		viewer: ThreadViewer;
		channels: ReadonlyArray<bigint>;
		requestCache: RequestCache;
	}): Promise<Record<string, unknown>> {
		const channelIds = params.channels.map((channelId) => createChannelID(channelId));
		return this.userChannelService.preloadDMMessages({
			userId: params.userId,
			viewer: params.viewer,
			channelIds,
		});
	}

	async getUserProfile(params: UserProfileParams): Promise<UserProfileFullResponse> {
		const guildId = params.guildId ? createGuildID(params.guildId) : undefined;
		const profileLookup = this.userAccountService.lookupService.getUserProfile({
			userId: params.currentUserId,
			targetId: params.targetUserId,
			guildId,
			withMutualFriends: params.withMutualFriends,
			withMutualGuilds: params.withMutualGuilds,
			requestCache: params.requestCache,
		});
		const [profile, badgeEnvironment] = await Promise.all([
			profileLookup,
			profileLookup.then((found) => loadProfileBadgeEnvironment(found.user.badgeIds)),
		]);
		const profileUser = profile.user;
		const restrictProfile = profile.restrictProfile;
		const hidden = isProfileHidden(profileUser);
		const userProfile = mapUserToProfileResponse(profileUser, {
			restrictProfile,
			viewerIsSelf: params.currentUserId === profileUser.id,
		});
		const guildMemberProfile = mapGuildMemberToProfileResponse(profile.guildMemberDomain ?? null, {
			restrictProfile,
			hidden,
		});
		const timezoneOffset = profile.timezoneVisible ? getCurrentTimeZoneOffsetMinutes(profileUser.timezone) : null;
		const mutualFriends = profile.mutualFriends
			? profile.mutualFriends.map(
					(user) =>
						params.requestCache.userPartials.get(user.id) ??
						this.userCacheService.setUserPartialResponseFromUserInRequestCache(user, params.requestCache),
				)
			: undefined;
		const connectedAccounts =
			profile.connections && !hidden ? this.mapConnectionsToResponse(profile.connections) : undefined;
		const viewerIsSelf = params.currentUserId === profileUser.id;
		const badgeInput = {
			user: profileUser,
			locale: params.requestLocale,
			environment: badgeEnvironment,
			restricted: restrictProfile,
			profileHidden: hidden,
		};
		const profileBadges = buildProfileBadges(badgeInput);
		const hiddenProfileBadgeCount = viewerIsSelf
			? buildOwnProfileBadges(badgeInput).filter((badge) => badge.hidden).length
			: undefined;
		return {
			user:
				params.requestCache.userPartials.get(profileUser.id) ??
				this.userCacheService.setUserPartialResponseFromUserInRequestCache(profileUser, params.requestCache),
			user_profile: userProfile,
			guild_member: profile.guildMember ?? undefined,
			guild_member_profile: guildMemberProfile ?? undefined,
			profile_badges: profileBadges,
			hidden_profile_badge_count: hiddenProfileBadgeCount,
			mutual_friends: mutualFriends,
			mutual_guilds: profile.mutualGuilds,
			connected_accounts: connectedAccounts,
			timezone_offset: timezoneOffset,
			profile_limited: restrictProfile ? true : undefined,
		};
	}

	async previewProfileBadges(params: {
		user: User;
		settings: ProfileBadgePreviewRequest;
		requestLocale: string;
	}): Promise<ProfileBadgePreviewResponse> {
		const {user, settings} = params;
		const environment = await loadProfileBadgeEnvironment(user.badgeIds);
		const input = {
			user: {
				flags: user.flags,
				badgeIds: user.badgeIds,
				hiddenProfileBadges: resolveHiddenProfileBadges(settings) ?? user.hiddenProfileBadges,
			},
			locale: params.requestLocale,
			environment,
			profileHidden: isProfileHidden(user),
		};
		return {profile_badges: buildProfileBadges(input), own_badges: buildOwnProfileBadges(input)};
	}

	checkTagAvailability(params: {currentUser: User; username: string; discriminator: number}): boolean {
		const currentUser = params.currentUser;
		const discriminator = params.discriminator;
		if (
			params.username.toLowerCase() === currentUser.username.toLowerCase() &&
			discriminator === currentUser.discriminator
		) {
			return false;
		}
		return true;
	}

	private stripBearerSensitiveFields(response: UserPrivateResponse): void {
		response.is_staff = false;
		response.acls = [];
		response.traits = [];
		response.timezone = undefined;
		response.timezone_privacy_flags = undefined;
		response.account_limited = undefined;
		response.last_voice_activity_sharing_change_at = null;
		response.age_verified_adult = undefined;
		response.terms_agreed_at = null;
		response.privacy_agreed_at = null;
		response.claimed = undefined;
		response.account_tier = undefined;
		response.verification_need = undefined;
		response.has_password = undefined;
		response.profile_restricted = undefined;
		response.mfa_enabled = false;
		response.authenticator_types = undefined;
		response.password_last_changed_at = null;
		response.nsfw_allowed = false;
		response.hidden_profile_badges = [];
		response.pending_bulk_message_deletion = null;
	}

	private requiresSensitiveUserVerification(user: User, data: UserUpdatePayload): boolean {
		const isUnclaimed = getAccountTier(user) === AccountTiers.UNCLAIMED;
		const usernameChanged = data.username !== undefined && data.username !== user.username;
		const discriminatorChanged = data.discriminator !== undefined && data.discriminator !== user.discriminator;
		const newPasswordProvided = data.new_password !== undefined;
		if (isUnclaimed) {
			return !isInteractionTierEnforced() && (usernameChanged || discriminatorChanged);
		}
		return usernameChanged || discriminatorChanged || newPasswordProvided;
	}

	private mapConnectionsToResponse(connections: Array<UserConnectionRow>): Array<ConnectionResponse> {
		return connections
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((connection) => ({
				id: connection.connection_id,
				type: connection.connection_type,
				name: connection.name,
				verified: connection.verified,
				visibility_flags: connection.visibility_flags,
				sort_order: connection.sort_order,
			}));
	}
}
