// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import type {UserRow} from '@app/api/database/types/UserTypes';
import {isProfileBadgeKey, type ProfileBadgeKey} from '@osaca/constants/src/BadgeConstants';
import {
	legacyHiddenProfileBadges,
	type MentionReplyPreference,
	ProfileFieldPrivacyFlags,
	type UserAuthenticatorType,
} from '@osaca/constants/src/UserConstants';

export class User {
	readonly id: UserID;
	readonly username: string;
	readonly discriminator: number;
	readonly globalName: string | null;
	readonly isBot: boolean;
	readonly isSystem: boolean;
	readonly email: string | null;
	readonly emailVerified: boolean;
	readonly emailBounced: boolean;
	readonly passwordHash: string | null;
	readonly passwordLastChangedAt: Date | null;
	readonly totpSecret: string | null;
	readonly authenticatorTypes: Set<UserAuthenticatorType>;
	readonly avatarHash: string | null;
	readonly avatarColor: number | null;
	readonly bannerHash: string | null;
	readonly bannerColor: number | null;
	readonly bio: string | null;
	readonly pronouns: string | null;
	readonly accentColor: number | null;
	readonly timezone: string | null;
	readonly timezonePrivacyFlags: number;
	readonly locale: string | null;
	readonly flags: bigint;
	readonly termsAgreedAt: Date | null;
	readonly privacyAgreedAt: Date | null;
	readonly lastActiveAt: Date | null;
	readonly lastActiveIp: string | null;
	readonly tempBannedUntil: Date | null;
	readonly pendingBulkMessageDeletionAt: Date | null;
	readonly pendingBulkMessageDeletionChannelCount: number | null;
	readonly pendingBulkMessageDeletionMessageCount: number | null;
	readonly pendingDeletionAt: Date | null;
	readonly deletionStartedAt: Date | null;
	readonly deletionReasonCode: number | null;
	readonly deletionPublicReason: string | null;
	readonly deletionAuditLogReason: string | null;
	readonly deletionScheduledBy: UserID | null;
	readonly deletionScheduledAt: Date | null;
	readonly enforcementDecisionId: bigint | null;
	readonly contentHiddenSince: Date | null;
	readonly acls: Set<string>;
	private readonly _traits: Set<string>;
	readonly badgeIds: ReadonlySet<bigint>;
	readonly hiddenProfileBadges: ReadonlySet<ProfileBadgeKey>;
	readonly mentionFlags: MentionReplyPreference;
	readonly lastVoiceActivitySharingChangeAt: Date | null;
	readonly version: number;

	constructor(row: UserRow) {
		this.id = row.user_id;
		this.username = row.username;
		this.discriminator = row.discriminator;
		this.globalName = row.global_name ?? null;
		this.isBot = row.bot ?? false;
		this.isSystem = row.system ?? false;
		this.email = row.email ?? null;
		this.emailVerified = row.email_verified ?? false;
		this.emailBounced = row.email_bounced ?? false;
		this.passwordHash = row.password_hash ?? null;
		this.passwordLastChangedAt = row.password_last_changed_at ?? null;
		this.totpSecret = row.totp_secret ?? null;
		this.authenticatorTypes = (row.authenticator_types ?? new Set()) as Set<UserAuthenticatorType>;
		this.avatarHash = row.avatar_hash ?? null;
		this.avatarColor = row.avatar_color ?? null;
		this.bannerHash = row.banner_hash ?? null;
		this.bannerColor = row.banner_color ?? null;
		this.bio = row.bio ?? null;
		this.pronouns = row.pronouns ?? null;
		this.accentColor = row.accent_color ?? null;
		this.timezone = row.timezone ?? null;
		this.timezonePrivacyFlags = row.timezone_privacy_flags ?? ProfileFieldPrivacyFlags.EVERYONE;
		this.locale = row.locale ?? null;
		const rawFlags = row.flags ?? 0n;
		this.flags = rawFlags;
		this.termsAgreedAt = row.terms_agreed_at ?? null;
		this.privacyAgreedAt = row.privacy_agreed_at ?? null;
		this.lastActiveAt = row.last_active_at ?? null;
		this.lastActiveIp = row.last_active_ip ?? null;
		this.tempBannedUntil = row.temp_banned_until ?? null;
		this.pendingBulkMessageDeletionAt = row.pending_bulk_message_deletion_at ?? null;
		this.pendingBulkMessageDeletionChannelCount = row.pending_bulk_message_deletion_channel_count ?? null;
		this.pendingBulkMessageDeletionMessageCount = row.pending_bulk_message_deletion_message_count ?? null;
		this.pendingDeletionAt = row.pending_deletion_at ?? null;
		this.deletionStartedAt = row.deletion_started_at ?? null;
		this.deletionReasonCode = row.deletion_reason_code ?? null;
		this.deletionPublicReason = row.deletion_public_reason ?? null;
		this.deletionAuditLogReason = row.deletion_audit_log_reason ?? null;
		this.deletionScheduledBy = row.deletion_scheduled_by ?? null;
		this.deletionScheduledAt = row.deletion_scheduled_at ?? null;
		this.enforcementDecisionId = row.enforcement_decision_id ?? null;
		this.contentHiddenSince = row.content_hidden_since ?? null;
		this.acls = row.acls ?? new Set();
		this._traits = row.traits ?? new Set();
		this.badgeIds = row.badge_ids ?? new Set();
		this.hiddenProfileBadges = new Set([
			...[...(row.hidden_profile_badges ?? [])].filter(isProfileBadgeKey),
			...legacyHiddenProfileBadges(rawFlags),
		]);
		this.mentionFlags = row.mention_flags ?? 0;
		this.lastVoiceActivitySharingChangeAt = row.last_voice_activity_sharing_change_at ?? null;
		this.version = row.version;
	}

	get traits(): Set<string> {
		return new Set(this._traits);
	}

	toRow(): UserRow {
		return {
			user_id: this.id,
			username: this.username,
			discriminator: this.discriminator,
			global_name: this.globalName,
			bot: this.isBot,
			system: this.isSystem,
			email: this.email,
			email_verified: this.emailVerified,
			email_bounced: this.emailBounced,
			password_hash: this.passwordHash,
			password_last_changed_at: this.passwordLastChangedAt,
			totp_secret: this.totpSecret,
			authenticator_types: this.authenticatorTypes.size > 0 ? this.authenticatorTypes : null,
			avatar_hash: this.avatarHash,
			avatar_color: this.avatarColor,
			banner_hash: this.bannerHash,
			banner_color: this.bannerColor,
			bio: this.bio,
			pronouns: this.pronouns,
			accent_color: this.accentColor,
			timezone: this.timezone,
			timezone_privacy_flags: this.timezonePrivacyFlags,
			locale: this.locale,
			flags: this.flags,
			terms_agreed_at: this.termsAgreedAt,
			privacy_agreed_at: this.privacyAgreedAt,
			last_active_at: this.lastActiveAt,
			last_active_ip: this.lastActiveIp,
			temp_banned_until: this.tempBannedUntil,
			pending_bulk_message_deletion_at: this.pendingBulkMessageDeletionAt,
			pending_bulk_message_deletion_channel_count: this.pendingBulkMessageDeletionChannelCount,
			pending_bulk_message_deletion_message_count: this.pendingBulkMessageDeletionMessageCount,
			pending_deletion_at: this.pendingDeletionAt,
			deletion_started_at: this.deletionStartedAt,
			deletion_reason_code: this.deletionReasonCode,
			deletion_public_reason: this.deletionPublicReason,
			deletion_audit_log_reason: this.deletionAuditLogReason,
			deletion_scheduled_by: this.deletionScheduledBy,
			deletion_scheduled_at: this.deletionScheduledAt,
			enforcement_decision_id: this.enforcementDecisionId,
			content_hidden_since: this.contentHiddenSince,
			acls: this.acls.size > 0 ? this.acls : null,
			traits: this._traits.size > 0 ? this._traits : null,
			badge_ids: this.badgeIds.size > 0 ? new Set(this.badgeIds) : null,
			hidden_profile_badges: this.hiddenProfileBadges.size > 0 ? new Set(this.hiddenProfileBadges) : null,
			mention_flags: this.mentionFlags,
			last_voice_activity_sharing_change_at: this.lastVoiceActivitySharingChangeAt,
			version: this.version,
		};
	}
}
