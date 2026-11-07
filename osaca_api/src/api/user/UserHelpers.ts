// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserRow} from '@app/api/database/types/UserTypes';
import type {User} from '@app/api/models/User';
import {isEnforcementReasonCode} from '@osaca/constants/src/EnforcementReasons';
import {
	DELETED_USER_DISCRIMINATOR,
	DELETED_USER_GLOBAL_NAME,
	DELETED_USER_USERNAME,
	ProfileFieldPrivacyFlags,
	UserFlags,
} from '@osaca/constants/src/UserConstants';
import {snowflakeToDate} from '@osaca/snowflake/src/Snowflake';

export function isEnforcementDeletion(user: Pick<User, 'enforcementDecisionId' | 'deletionReasonCode'>): boolean {
	return user.enforcementDecisionId !== null || isEnforcementReasonCode(user.deletionReasonCode);
}

export function isAccountClosed(user: Pick<User, 'flags' | 'deletionStartedAt'>): boolean {
	return (user.flags & UserFlags.DELETED) !== 0n || user.deletionStartedAt != null;
}

export function isDeletionComplete(user: Pick<User, 'flags' | 'pendingDeletionAt'>): boolean {
	return (user.flags & UserFlags.DELETED) !== 0n && user.pendingDeletionAt === null;
}

const FIELDS_CLEARED_ON_DELETION = [
	'password_hash',
	'password_last_changed_at',
	'totp_secret',
	'authenticator_types',
	'avatar_hash',
	'avatar_color',
	'banner_hash',
	'banner_color',
	'bio',
	'pronouns',
	'accent_color',
	'timezone',
	'locale',
	'hidden_profile_badges',
	'terms_agreed_at',
	'privacy_agreed_at',
	'last_active_at',
	'last_active_ip',
	'acls',
	'traits',
	'mention_flags',
	'last_voice_activity_sharing_change_at',
] as const satisfies ReadonlyArray<keyof UserRow>;

export function deletedUserIdentity() {
	return {
		username: DELETED_USER_USERNAME,
		discriminator: DELETED_USER_DISCRIMINATOR,
		global_name: DELETED_USER_GLOBAL_NAME,
		timezone_privacy_flags: ProfileFieldPrivacyFlags.EVERYONE,
		flags: UserFlags.DELETED,
	} satisfies Partial<UserRow>;
}

export function personalFieldsToClear(row: UserRow): Partial<UserRow> {
	const patch: Partial<UserRow> = {};
	for (const field of FIELDS_CLEARED_ON_DELETION) {
		const value = row[field];
		if (!value || (value instanceof Set && value.size === 0)) continue;
		patch[field] = null;
	}
	return patch;
}

export function isTemporarilyBanned(user: Pick<User, 'flags' | 'tempBannedUntil'>, now = Date.now()): boolean {
	return (
		(user.flags & UserFlags.DISABLED) !== 0n && user.tempBannedUntil != null && user.tempBannedUntil.getTime() > now
	);
}

function isAccountDisabled(user: Pick<User, 'flags' | 'tempBannedUntil'>, now = Date.now()): boolean {
	if ((user.flags & UserFlags.DISABLED) === 0n) return false;
	return user.tempBannedUntil == null || user.tempBannedUntil.getTime() > now;
}

export function isHeldByDecision(
	user: Pick<User, 'flags' | 'deletionStartedAt' | 'tempBannedUntil' | 'enforcementDecisionId'>,
): boolean {
	return user.enforcementDecisionId !== null && isSignInRefused(user);
}

export function isSignInRefused(user: Pick<User, 'flags' | 'deletionStartedAt' | 'tempBannedUntil'>): boolean {
	return isAccountClosed(user) || isTemporarilyBanned(user);
}

export function canOwnerRunBots(owner: Pick<User, 'flags' | 'deletionStartedAt' | 'tempBannedUntil'>): boolean {
	return !isAccountClosed(owner) && !isAccountDisabled(owner);
}

export function isContentHidden(user: Pick<User, 'contentHiddenSince'>, messageId: bigint): boolean {
	return user.contentHiddenSince !== null && snowflakeToDate(messageId) >= user.contentHiddenSince;
}

export function isDirectDeliverySuppressed(user: Pick<User, 'isBot' | 'flags'>): boolean {
	return !user.isBot && (user.flags & UserFlags.SPAMMER) === UserFlags.SPAMMER;
}

const PROFILE_SUBSTRING_EXEMPT_FLAGS = UserFlags.STAFF;

export function isProfileSubstringExempt(user: Pick<User, 'flags'>): boolean {
	return (user.flags & PROFILE_SUBSTRING_EXEMPT_FLAGS) !== 0n;
}

export function isBugHunterBotUser(user: Pick<User, 'flags' | 'isBot'>): boolean {
	return user.isBot && (user.flags & UserFlags.BUG_HUNTER) !== 0n;
}
