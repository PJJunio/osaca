// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import type {ValueOf} from '@osaca/constants/src/ValueOf';

export const AccountTiers = {
	UNCLAIMED: 'unclaimed',
	VERIFIED: 'verified',
} as const;

export type AccountTier = ValueOf<typeof AccountTiers>;

export type RestrictedAccountTier = Exclude<AccountTier, typeof AccountTiers.VERIFIED>;

export const AccountVerificationNeeds = {
	SET_PASSWORD: 'password',
} as const;

export type AccountVerificationNeed = ValueOf<typeof AccountVerificationNeeds>;

export const TierGatedActions = {
	MESSAGE: 'message',
	TYPING: 'typing',
	REACTION: 'reaction',
	DIRECT_MESSAGE: 'direct_message',
	DIRECT_MESSAGE_OPEN: 'direct_message_open',
	GROUP_DM: 'group_dm',
	FRIEND_REQUEST: 'friend_request',
	FRIEND_ACCEPT: 'friend_accept',
	INVITE_CREATE: 'invite_create',
	GUILD_JOIN: 'guild_join',
	GUILD_CREATE: 'guild_create',
	VOICE: 'voice',
	CALL: 'call',
	GROUP_CALL: 'group_call',
	THREAD_JOIN: 'thread_join',
	CHANNEL_FOLLOW: 'channel_follow',
	OWNERSHIP_TRANSFER: 'ownership_transfer',
	APPLICATION_CREATE: 'application_create',
	GIFT_REDEEM: 'gift_redeem',
	PROFILE_CUSTOMIZE: 'profile_customize',
	REPORT: 'report',
	MFA: 'mfa',
	GUILD_VERIFICATION: 'guild_verification',
} as const;

export type TierGatedAction = ValueOf<typeof TierGatedActions>;

export const TierExemptions = {
	GUILD_OWNER: 'guild_owner',
} as const;

export type TierExemption = ValueOf<typeof TierExemptions>;

export const LocalCredentialKinds = {
	NONE: 'none',
	PASSWORD: 'password',
	PASSKEY: 'passkey',
	PASSWORD_AND_PASSKEY: 'password_and_passkey',
} as const;

export type LocalCredentialKind = ValueOf<typeof LocalCredentialKinds>;

export function localCredentialKindOf(params: {hasPassword: boolean; hasPasskey: boolean}): LocalCredentialKind {
	if (params.hasPassword && params.hasPasskey) return LocalCredentialKinds.PASSWORD_AND_PASSKEY;
	if (params.hasPassword) return LocalCredentialKinds.PASSWORD;
	if (params.hasPasskey) return LocalCredentialKinds.PASSKEY;
	return LocalCredentialKinds.NONE;
}

export const TierDenialErrors = {
	ACCOUNT_VERIFICATION_REQUIRED: APIErrorCodes.ACCOUNT_VERIFICATION_REQUIRED,
} as const;

export type TierDenialError = ValueOf<typeof TierDenialErrors>;
