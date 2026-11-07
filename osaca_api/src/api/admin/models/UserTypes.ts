// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {hasAdminACL} from '@app/api/middleware/AdminMiddleware';
import type {User} from '@app/api/models/User';
import {getAccountTier} from '@app/api/user/AccountTier';
import {isProfileHidden} from '@app/api/user/ProfileVisibility';
import {buildOperatorProfileBadges} from '@app/api/user/profile_badges/ProfileBadgeBuilder';
import {loadProfileBadgeEnvironment} from '@app/api/user/profile_badges/ProfileBadgeEnvironment';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import {getIpAddressReverse} from '@app/api/utils/IpUtils';
import {AccountTiers} from '@osaca/constants/src/AccountTierConstants';
import {AdminACLs, filterKnownAdminACLs} from '@osaca/constants/src/AdminACLs';
import {DeletionReasons} from '@osaca/constants/src/Core';
import type {ValueOf} from '@osaca/constants/src/ValueOf';
import type {AdminResolvedUser, UserAdminResponse} from '@osaca/schema/src/domains/admin/AdminUserSchemas';
import type {AdminProfileBadgeResponse} from '@osaca/schema/src/domains/user/ProfileBadgeSchemas';
import type {ICacheService} from '@pkgs/cache/src/ICacheService';

const DELETION_REASON_CODES: ReadonlySet<number> = new Set(Object.values(DeletionReasons));

function deletionReasonCode(code: number | null): ValueOf<typeof DeletionReasons> | null {
	return code !== null && DELETION_REASON_CODES.has(code) ? (code as ValueOf<typeof DeletionReasons>) : null;
}

async function buildAdminProfileBadges(
	user: User,
	locale: string | undefined,
): Promise<Array<AdminProfileBadgeResponse>> {
	const environment = await loadProfileBadgeEnvironment(user.badgeIds);
	return buildOperatorProfileBadges({
		user,
		locale,
		environment,
		profileHidden: isProfileHidden(user),
	});
}

export async function mapUserToAdminResponse(
	user: User,
	cacheService?: ICacheService,
	acls?: ReadonlySet<string>,
	locale?: string,
): Promise<UserAdminResponse> {
	const canViewIp = !acls || hasAdminACL(acls, AdminACLs.USER_VIEW_IP);
	const canViewAuditLog = !acls || hasAdminACL(acls, AdminACLs.AUDIT_LOG_VIEW);
	const [lastActiveIpReverse, profileBadges] = await Promise.all([
		canViewIp && user.lastActiveIp ? getIpAddressReverse(user.lastActiveIp, cacheService) : null,
		buildAdminProfileBadges(user, locale),
	]);
	const lastActiveLocation: string | null = null;
	const accountTier = getAccountTier(user);
	return {
		id: user.id.toString(),
		username: user.username,
		discriminator: user.discriminator,
		global_name: user.globalName,
		bot: user.isBot,
		system: user.isSystem,
		flags: user.flags.toString(),
		avatar: user.avatarHash,
		banner: user.bannerHash,
		bio: user.bio,
		pronouns: user.pronouns,
		accent_color: user.accentColor,
		locale: user.locale,
		profile_badges: profileBadges,
		temp_banned_until:
			user.tempBannedUntil && user.tempBannedUntil.getTime() > Date.now() ? user.tempBannedUntil.toISOString() : null,
		pending_deletion_at: user.pendingDeletionAt?.toISOString() ?? null,
		pending_bulk_message_deletion_at: user.pendingBulkMessageDeletionAt?.toISOString() ?? null,
		deletion_reason_code: deletionReasonCode(user.deletionReasonCode),
		deletion_public_reason: user.deletionPublicReason,
		deletion_audit_log_reason: canViewAuditLog ? user.deletionAuditLogReason : null,
		deletion_scheduled_by: user.deletionScheduledBy?.toString() ?? null,
		deletion_scheduled_at: user.deletionScheduledAt?.toISOString() ?? null,
		enforcement_decision_id: user.enforcementDecisionId?.toString() ?? null,
		acls: user.acls ? filterKnownAdminACLs(user.acls) : [],
		traits: Array.from(user.traits).sort(),
		badge_ids: Array.from(user.badgeIds, String),
		has_totp: user.totpSecret !== null,
		has_password: user.passwordHash !== null,
		claimed: accountTier !== AccountTiers.UNCLAIMED,
		account_tier: accountTier,
		authenticator_types: user.authenticatorTypes ? Array.from(user.authenticatorTypes) : [],
		last_active_at: user.lastActiveAt?.toISOString() ?? null,
		last_active_ip: canViewIp ? (user.lastActiveIp ?? null) : null,
		last_active_ip_reverse: canViewIp ? lastActiveIpReverse : null,
		last_active_location: canViewIp ? lastActiveLocation : null,
	};
}

export async function resolveAdminUsers(
	userRepository: Pick<UserRepository, 'findUnique'>,
	userIds: Array<UserID>,
): Promise<Map<UserID, AdminResolvedUser>> {
	const results = new Map<UserID, AdminResolvedUser>();
	const users = await Promise.all(userIds.map((id) => userRepository.findUnique(id)));
	for (let i = 0; i < userIds.length; i++) {
		const user = users[i];
		if (user)
			results.set(userIds[i], {
				id: user.id.toString(),
				username: user.username,
				discriminator: String(user.discriminator).padStart(4, '0'),
				global_name: user.globalName,
				avatar: user.avatarHash,
			});
	}
	return results;
}
