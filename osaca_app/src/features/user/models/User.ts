// SPDX-License-Identifier: AGPL-3.0-or-later

import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {LimitResolver} from '@app/features/app/utils/LimitResolverAdapter';
import DeveloperOptions from '@app/features/devtools/state/DeveloperOptions';
import {formatUserTag} from '@app/features/user/utils/UserTagUtils';
import {
	type AccountTier,
	AccountTiers,
	type AccountVerificationNeed,
	type LocalCredentialKind,
	localCredentialKindOf,
} from '@osaca/constants/src/AccountTierConstants';
import {resolveAccountTier, resolveVerificationNeed} from '@osaca/constants/src/AccountTierRules';
import type {LimitKey} from '@osaca/constants/src/LimitConfigMetadata';
import {
	type MentionReplyPreference,
	ProfileFieldPrivacyFlags,
	PublicUserFlags,
	UserAuthenticatorTypes,
} from '@osaca/constants/src/UserConstants';
import {UserTraits} from '@osaca/constants/src/UserTraitConstants';
import {DEFAULT_LIMITS} from '@osaca/limits/src/LimitDefaults';
import type {UserPartial, UserPrivate, User as WireUser} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import * as SnowflakeUtils from '@osaca/snowflake/src/SnowflakeUtils';

interface UserRecordOptions {
	instanceId?: string;
}

type MergeOptions = Readonly<{
	clearMissing: boolean;
}>;

type MutableWireUser = {
	-readonly [K in keyof WireUser]: WireUser[K];
};

const EMPTY_STRING_ARRAY: ReadonlyArray<string> = Object.freeze([]);
const EMPTY_AUTH_TYPES: ReadonlyArray<number> = Object.freeze([]);

function parseDateOrNull(value: string | number | Date | null | undefined): Date | null {
	if (value == null) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function dateToIsoOrNull(value: Date | null | undefined): string | null {
	if (value == null) return null;
	return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function pickField<K extends keyof WireUser>(
	current: WireUser[K] | undefined,
	updates: Partial<WireUser>,
	key: K,
	opts: MergeOptions,
): WireUser[K] | undefined {
	if (key in updates) return updates[key];
	if (opts.clearMissing) return undefined;
	return current;
}

function pickDateField<K extends keyof WireUser>(
	current: Date | null | undefined,
	updates: Partial<WireUser>,
	key: K,
	opts: MergeOptions,
): Date | null | undefined {
	if (key in updates) {
		return parseDateOrNull(updates[key] as string | null | undefined);
	}
	if (opts.clearMissing) return undefined;
	return current;
}

function mergeTraitsArray(
	current: ReadonlyArray<string>,
	updates: Partial<WireUser>,
	opts: MergeOptions,
): ReadonlyArray<string> {
	if (!('traits' in updates)) {
		return opts.clearMissing ? EMPTY_STRING_ARRAY : current;
	}
	const raw = updates.traits;
	if (!Array.isArray(raw)) return current;
	const out = dedupeFiltered(raw, parseStringItem);
	if (out.length === 0 && !opts.clearMissing) {
		return current;
	}
	return out.length === 0 ? EMPTY_STRING_ARRAY : Object.freeze(out);
}

function mergeAuthoritativeArray<T>(
	current: ReadonlyArray<T>,
	updates: Partial<WireUser>,
	key: keyof WireUser,
	parseItem: (item: unknown) => T | null,
	opts: MergeOptions,
	emptySentinel: ReadonlyArray<T>,
): ReadonlyArray<T> {
	if (!(key in updates)) {
		return opts.clearMissing ? emptySentinel : current;
	}
	const raw = updates[key];
	if (!Array.isArray(raw)) return current;
	const out = dedupeFiltered(raw, parseItem);
	return out.length === 0 ? emptySentinel : Object.freeze(out);
}

function dedupeFiltered<T>(raw: ReadonlyArray<unknown>, parseItem: (item: unknown) => T | null): Array<T> {
	const seen = new Set<T>();
	const out: Array<T> = [];
	for (const item of raw) {
		const parsed = parseItem(item);
		if (parsed == null) continue;
		if (seen.has(parsed)) continue;
		seen.add(parsed);
		out.push(parsed);
	}
	return out;
}

const parseStringItem = (item: unknown): string | null => (typeof item === 'string' && item.length > 0 ? item : null);
const parseAuthenticatorType = (item: unknown): number | null => {
	if (typeof item !== 'number' || !Number.isFinite(item)) return null;
	return item;
};

function hasKey<K extends string>(obj: object, key: K): boolean {
	return key in obj;
}

export class User {
	readonly instanceId: string;
	readonly id: string;
	readonly username: string;
	readonly discriminator: string;
	readonly globalName: string | null;
	readonly avatar: string | null;
	readonly bot: boolean;
	readonly system: boolean;
	readonly flags: number;
	readonly mentionFlags: MentionReplyPreference;
	readonly avatarColor: number | null | undefined;
	private readonly _isStaff: boolean | undefined;
	private readonly _email: string | null | undefined;
	private readonly _emailBounced: boolean | undefined;
	private readonly _accountLimited: boolean | undefined;
	readonly bio: string | null | undefined;
	readonly banner: string | null | undefined;
	readonly bannerColor: number | null | undefined;
	readonly pronouns: string | null | undefined;
	readonly accentColor: number | null | undefined;
	readonly timezone: string | null | undefined;
	readonly timezonePrivacyFlags: number | undefined;
	readonly mfaEnabled: boolean | undefined;
	readonly authenticatorTypes: ReadonlyArray<number> | undefined;
	private readonly _verified: boolean | undefined;
	readonly hiddenProfileBadges: ReadonlyArray<string> | undefined;
	readonly passwordLastChangedAt: Date | null | undefined;
	readonly lastVoiceActivitySharingChangeAt: Date | null | undefined;
	private readonly _nsfwAllowed: boolean | undefined;
	private readonly _ageVerifiedAdult: boolean | undefined;
	private readonly _termsAgreedAt: Date | null | undefined;
	private readonly _privacyAgreedAt: Date | null | undefined;
	private readonly _traits: ReadonlyArray<string>;
	private readonly _claimed: boolean | undefined;
	private readonly _accountTier: AccountTier | undefined;
	private readonly _verificationNeed: AccountVerificationNeed | null | undefined;
	private readonly _hasPassword: boolean | undefined;

	constructor(user: WireUser, options?: UserRecordOptions) {
		this.instanceId = options?.instanceId ?? RuntimeConfig.localInstanceDomain;
		this.id = user.id;
		this.username = user.username;
		this.discriminator = user.discriminator;
		this.globalName = user.global_name ?? null;
		this.avatar = user.avatar;
		this.bot = user.bot ?? false;
		this.system = user.system ?? false;
		this.flags = user.flags;
		this.mentionFlags = user.mention_flags ?? 0;
		this.avatarColor = hasKey(user, 'avatar_color') ? user.avatar_color : undefined;
		this._isStaff = hasKey(user, 'is_staff') ? user.is_staff : undefined;
		this._email = hasKey(user, 'email') ? (user.email ?? null) : undefined;
		this._emailBounced = hasKey(user, 'email_bounced') ? user.email_bounced : undefined;
		this._accountLimited = hasKey(user, 'account_limited') ? user.account_limited : undefined;
		this.bio = hasKey(user, 'bio') ? (user.bio ?? null) : undefined;
		this.banner = hasKey(user, 'banner') ? (user.banner ?? null) : undefined;
		this.bannerColor = hasKey(user, 'banner_color') ? (user.banner_color ?? null) : undefined;
		this.pronouns = hasKey(user, 'pronouns') ? (user.pronouns ?? null) : undefined;
		this.accentColor = hasKey(user, 'accent_color') ? (user.accent_color ?? null) : undefined;
		this.timezone = hasKey(user, 'timezone') ? (user.timezone ?? null) : undefined;
		this.timezonePrivacyFlags = hasKey(user, 'timezone_privacy_flags')
			? (user.timezone_privacy_flags ?? ProfileFieldPrivacyFlags.EVERYONE)
			: undefined;
		this.mfaEnabled = hasKey(user, 'mfa_enabled') ? user.mfa_enabled : undefined;
		this.authenticatorTypes = hasKey(user, 'authenticator_types')
			? Object.freeze(((user.authenticator_types ?? []) as ReadonlyArray<number>).slice())
			: undefined;
		this._verified = hasKey(user, 'verified') ? user.verified : undefined;
		this.hiddenProfileBadges = hasKey(user, 'hidden_profile_badges')
			? Object.freeze([...(user.hidden_profile_badges ?? [])])
			: undefined;
		this.passwordLastChangedAt = hasKey(user, 'password_last_changed_at')
			? parseDateOrNull(user.password_last_changed_at)
			: undefined;
		this.lastVoiceActivitySharingChangeAt = hasKey(user, 'last_voice_activity_sharing_change_at')
			? parseDateOrNull(user.last_voice_activity_sharing_change_at)
			: undefined;
		this._nsfwAllowed = hasKey(user, 'nsfw_allowed') ? user.nsfw_allowed : undefined;
		this._ageVerifiedAdult = hasKey(user, 'age_verified_adult') ? user.age_verified_adult : undefined;
		this._termsAgreedAt = hasKey(user, 'terms_agreed_at') ? parseDateOrNull(user.terms_agreed_at) : undefined;
		this._privacyAgreedAt = hasKey(user, 'privacy_agreed_at') ? parseDateOrNull(user.privacy_agreed_at) : undefined;
		this._traits = mergeTraitsArray(EMPTY_STRING_ARRAY, user, {clearMissing: true});
		this._claimed = hasKey(user, 'claimed') ? user.claimed : undefined;
		this._accountTier = hasKey(user, 'account_tier') ? user.account_tier : undefined;
		this._verificationNeed = hasKey(user, 'verification_need') ? user.verification_need : undefined;
		this._hasPassword = hasKey(user, 'has_password') ? user.has_password : undefined;
	}

	get email(): string | null | undefined {
		if (DeveloperOptions.unclaimedAccountOverride === true) {
			return null;
		}
		return this._email;
	}

	get emailBounced(): boolean | undefined {
		return this._emailBounced;
	}

	get accountLimited(): boolean {
		return this._accountLimited === true;
	}

	get verified(): boolean | undefined {
		const verifiedOverride = DeveloperOptions.emailVerifiedOverride;
		if (verifiedOverride != null) {
			return verifiedOverride;
		}
		return this._verified;
	}

	get matureContentAllowed(): boolean | undefined {
		return this._nsfwAllowed;
	}

	get matureContentCheckComplete(): boolean | undefined {
		return this._ageVerifiedAdult;
	}

	get termsAgreedAt(): Date | null | undefined {
		return this._termsAgreedAt;
	}

	get privacyAgreedAt(): Date | null | undefined {
		return this._privacyAgreedAt;
	}

	get traits(): ReadonlyArray<string> {
		return this._traits;
	}

	get displayName(): string {
		return this.globalName || this.username;
	}

	get tag(): string {
		return formatUserTag(this);
	}

	get createdAt(): Date {
		return new Date(SnowflakeUtils.extractTimestamp(this.id));
	}

	private buildMergedPayload(updates: Partial<WireUser>, opts: MergeOptions): WireUser {
		const u = updates;
		const result: MutableWireUser = {
			id: u.id ?? this.id,
			username: u.username ?? this.username,
			discriminator: u.discriminator ?? this.discriminator,
			global_name: hasKey(u, 'global_name') ? (u.global_name ?? null) : this.globalName,
			avatar: hasKey(u, 'avatar') ? (u.avatar ?? null) : this.avatar,
			avatar_color: hasKey(u, 'avatar_color') ? (u.avatar_color ?? null) : (this.avatarColor ?? null),
			bot: u.bot ?? this.bot,
			system: u.system ?? this.system,
			flags: u.flags ?? this.flags,
			mention_flags: hasKey(u, 'mention_flags') ? u.mention_flags : this.mentionFlags || undefined,
		};
		const isStaff = pickField(this._isStaff, u, 'is_staff', opts);
		if (isStaff !== undefined) result.is_staff = isStaff;
		const avatarColor = pickField(this.avatarColor, u, 'avatar_color', opts);
		if (avatarColor !== undefined) result.avatar_color = avatarColor ?? null;
		const email = pickField(this._email, u, 'email', opts);
		if (email !== undefined) result.email = email;
		const emailBounced = pickField(this._emailBounced, u, 'email_bounced', opts);
		if (emailBounced !== undefined) result.email_bounced = emailBounced;
		const accountLimited = pickField(this._accountLimited, u, 'account_limited', opts);
		if (accountLimited !== undefined) result.account_limited = accountLimited;
		const bio = pickField(this.bio, u, 'bio', opts);
		if (bio !== undefined) result.bio = bio;
		const banner = pickField(this.banner, u, 'banner', opts);
		if (banner !== undefined) result.banner = banner;
		const bannerColor = pickField(this.bannerColor, u, 'banner_color', opts);
		if (bannerColor !== undefined) result.banner_color = bannerColor;
		const pronouns = pickField(this.pronouns, u, 'pronouns', opts);
		if (pronouns !== undefined) result.pronouns = pronouns;
		const accentColor = pickField(this.accentColor, u, 'accent_color', opts);
		if (accentColor !== undefined) result.accent_color = accentColor;
		const timezone = pickField(this.timezone, u, 'timezone', opts);
		if (timezone !== undefined) result.timezone = timezone;
		const timezonePrivacyFlags = pickField(this.timezonePrivacyFlags, u, 'timezone_privacy_flags', opts);
		if (timezonePrivacyFlags !== undefined) result.timezone_privacy_flags = timezonePrivacyFlags;
		const mfaEnabled = pickField(this.mfaEnabled, u, 'mfa_enabled', opts);
		if (mfaEnabled !== undefined) result.mfa_enabled = mfaEnabled;
		if (hasKey(u, 'authenticator_types') || this.authenticatorTypes !== undefined || opts.clearMissing) {
			result.authenticator_types = mergeAuthoritativeArray(
				this.authenticatorTypes ?? EMPTY_AUTH_TYPES,
				u,
				'authenticator_types',
				parseAuthenticatorType,
				opts,
				EMPTY_AUTH_TYPES,
			);
		}
		const verified = pickField(this._verified, u, 'verified', opts);
		if (verified !== undefined) result.verified = verified;
		const hiddenProfileBadges = pickField(this.hiddenProfileBadges, u, 'hidden_profile_badges', opts);
		if (hiddenProfileBadges !== undefined) result.hidden_profile_badges = hiddenProfileBadges;
		const passwordLastChangedAt = pickDateField(this.passwordLastChangedAt, u, 'password_last_changed_at', opts);
		if (passwordLastChangedAt !== undefined) result.password_last_changed_at = dateToIsoOrNull(passwordLastChangedAt);
		const lastVoiceActivitySharingChangeAt = pickDateField(
			this.lastVoiceActivitySharingChangeAt,
			u,
			'last_voice_activity_sharing_change_at',
			opts,
		);
		if (lastVoiceActivitySharingChangeAt !== undefined) {
			result.last_voice_activity_sharing_change_at = dateToIsoOrNull(lastVoiceActivitySharingChangeAt);
		}
		const nsfwAllowed = pickField(this._nsfwAllowed, u, 'nsfw_allowed', opts);
		if (nsfwAllowed !== undefined) result.nsfw_allowed = nsfwAllowed;
		const ageVerifiedAdult = pickField(this._ageVerifiedAdult, u, 'age_verified_adult', opts);
		if (ageVerifiedAdult !== undefined) result.age_verified_adult = ageVerifiedAdult;
		const termsAgreedAt = pickDateField(this._termsAgreedAt, u, 'terms_agreed_at', opts);
		if (termsAgreedAt !== undefined) result.terms_agreed_at = dateToIsoOrNull(termsAgreedAt);
		const privacyAgreedAt = pickDateField(this._privacyAgreedAt, u, 'privacy_agreed_at', opts);
		if (privacyAgreedAt !== undefined) result.privacy_agreed_at = dateToIsoOrNull(privacyAgreedAt);
		result.traits = mergeTraitsArray(this._traits, u, opts);
		const claimed = pickField(this._claimed, u, 'claimed', opts);
		if (claimed !== undefined) result.claimed = claimed;
		const accountTier = pickField(this._accountTier, u, 'account_tier', opts);
		if (accountTier !== undefined) result.account_tier = accountTier;
		const verificationNeed = pickField(this._verificationNeed, u, 'verification_need', opts);
		if (verificationNeed !== undefined) result.verification_need = verificationNeed;
		const hasPassword = pickField(this._hasPassword, u, 'has_password', opts);
		if (hasPassword !== undefined) result.has_password = hasPassword;
		return result;
	}

	withUpdates(
		updates: Partial<WireUser>,
		options?: {
			clearMissingOptionalFields?: boolean;
		},
	): User {
		const opts: MergeOptions = {clearMissing: options?.clearMissingOptionalFields ?? false};
		const merged = this.buildMergedPayload(updates, opts);
		return new User(merged, {instanceId: this.instanceId});
	}

	get maxGuilds(): number {
		return this.resolveRuntimeLimit('max_guilds', DEFAULT_LIMITS.max_guilds);
	}

	get maxMessageLength(): number {
		return this.resolveRuntimeLimit('max_message_length', DEFAULT_LIMITS.max_message_length);
	}

	get maxAttachmentFileSize(): number {
		return this.resolveRuntimeLimit('max_attachment_file_size', DEFAULT_LIMITS.max_attachment_file_size);
	}

	get maxAttachmentsPerMessage(): number {
		return this.resolveRuntimeLimit('max_attachments_per_message', DEFAULT_LIMITS.max_attachments_per_message);
	}

	get maxBioLength(): number {
		return this.resolveRuntimeLimit('max_bio_length', DEFAULT_LIMITS.max_bio_length);
	}

	get maxBookmarks(): number {
		return this.resolveRuntimeLimit('max_bookmarks', DEFAULT_LIMITS.max_bookmarks);
	}

	get maxFavoriteMemes(): number {
		return this.resolveRuntimeLimit('max_favorite_memes', DEFAULT_LIMITS.max_favorite_memes);
	}

	get maxFavoriteMemeTags(): number {
		return this.resolveRuntimeLimit('max_favorite_meme_tags', DEFAULT_LIMITS.max_favorite_meme_tags);
	}

	get guildVisitHistoryDays(): number {
		return this.resolveRuntimeLimit(
			'guild_visit_history_days_unverified',
			DEFAULT_LIMITS.guild_visit_history_days_unverified,
		);
	}

	get maxGroupDmRecipients(): number {
		return this.resolveRuntimeLimit('max_group_dm_recipients', DEFAULT_LIMITS.max_group_dm_recipients);
	}

	private resolveRuntimeLimit(key: LimitKey, fallback: number): number {
		return LimitResolver.resolve({
			key,
			fallback,
			context: {traits: this._traits},
		});
	}

	isStaff(): boolean {
		return this._isStaff ?? (this.flags & PublicUserFlags.STAFF) !== 0;
	}

	isClaimed(): boolean {
		return this.accountTier !== AccountTiers.UNCLAIMED;
	}

	get reportsAccountTier(): boolean {
		return this._accountTier !== undefined || this._claimed !== undefined;
	}

	get localCredential(): LocalCredentialKind {
		return localCredentialKindOf({
			hasPassword: this.hasPassword,
			hasPasskey:
				this._traits.includes(UserTraits.PASSKEY) ||
				(this.authenticatorTypes?.includes(UserAuthenticatorTypes.WEBAUTHN) ?? false),
		});
	}

	get accountTier(): AccountTier {
		if (DeveloperOptions.unclaimedAccountOverride === true) return AccountTiers.UNCLAIMED;
		const usesServerTier = DeveloperOptions.emailVerifiedOverride == null;
		if (usesServerTier && this._accountTier !== undefined) return this._accountTier;
		const derived = resolveAccountTier({
			isBot: this.bot,
			isSystem: this.system,
			traits: this._traits,
			identityMode: RuntimeConfig.accountIdentity,
			effectiveBasis: RuntimeConfig.verificationBasis,
			hasEmail: this.email != null,
			emailVerified: this.verified === true,
			localCredential: this.localCredential,
		});
		if (this._claimed === undefined) return derived;
		if (!this._claimed) return AccountTiers.UNCLAIMED;
		return derived === AccountTiers.UNCLAIMED ? AccountTiers.VERIFIED : derived;
	}

	get verificationNeed(): AccountVerificationNeed | null {
		const tier = this.accountTier;
		if (
			this._verificationNeed !== undefined &&
			this._accountTier === tier &&
			DeveloperOptions.unclaimedAccountOverride !== true &&
			DeveloperOptions.emailVerifiedOverride == null
		) {
			return this._verificationNeed;
		}
		return resolveVerificationNeed({tier, identityMode: RuntimeConfig.accountIdentity, hasEmail: this.email != null});
	}

	get hasPassword(): boolean {
		return this._hasPassword ?? this.passwordLastChangedAt != null;
	}

	equals(other: User): boolean {
		if (this === other) return true;
		return (
			this.instanceId === other.instanceId &&
			this.id === other.id &&
			this.username === other.username &&
			this.discriminator === other.discriminator &&
			this.globalName === other.globalName &&
			this.avatar === other.avatar &&
			this.avatarColor === other.avatarColor &&
			this.bot === other.bot &&
			this.system === other.system &&
			this.flags === other.flags &&
			this.mentionFlags === other.mentionFlags &&
			this._isStaff === other._isStaff &&
			this._email === other._email &&
			this._emailBounced === other._emailBounced &&
			this._accountLimited === other._accountLimited &&
			this.bio === other.bio &&
			this.banner === other.banner &&
			this.bannerColor === other.bannerColor &&
			this.pronouns === other.pronouns &&
			this.accentColor === other.accentColor &&
			this.timezone === other.timezone &&
			this.timezonePrivacyFlags === other.timezonePrivacyFlags &&
			this.mfaEnabled === other.mfaEnabled &&
			arraysShallowEqual(this.authenticatorTypes, other.authenticatorTypes) &&
			this._verified === other._verified &&
			arraysShallowEqual(this.hiddenProfileBadges, other.hiddenProfileBadges) &&
			datesEqual(this.passwordLastChangedAt, other.passwordLastChangedAt) &&
			datesEqual(this.lastVoiceActivitySharingChangeAt, other.lastVoiceActivitySharingChangeAt) &&
			this._nsfwAllowed === other._nsfwAllowed &&
			this._ageVerifiedAdult === other._ageVerifiedAdult &&
			datesEqual(this._termsAgreedAt, other._termsAgreedAt) &&
			datesEqual(this._privacyAgreedAt, other._privacyAgreedAt) &&
			arraysShallowEqual(this._traits, other._traits) &&
			this._claimed === other._claimed &&
			this._accountTier === other._accountTier &&
			this._verificationNeed === other._verificationNeed &&
			this._hasPassword === other._hasPassword
		);
	}

	toJSON(): WireUser {
		const baseFields: UserPartial = {
			id: this.id,
			username: this.username,
			discriminator: this.discriminator,
			global_name: this.globalName,
			avatar: this.avatar,
			avatar_color: this.avatarColor ?? null,
			bot: this.bot,
			system: this.system,
			flags: this.flags,
			mention_flags: this.mentionFlags || undefined,
		};
		const privateFields: Record<string, unknown> = {};
		const setOptional = <K extends keyof UserPrivate>(key: K, value: UserPrivate[K] | undefined): void => {
			if (value !== undefined) privateFields[key as string] = value;
		};
		setOptional('is_staff', this._isStaff);
		setOptional('email', this._email);
		setOptional('email_bounced', this._emailBounced);
		setOptional('account_limited', this._accountLimited);
		setOptional('bio', this.bio);
		setOptional('banner', this.banner);
		setOptional('banner_color', this.bannerColor);
		setOptional('pronouns', this.pronouns);
		setOptional('accent_color', this.accentColor);
		if (this.isStaff()) {
			setOptional('timezone', this.timezone);
			setOptional('timezone_privacy_flags', this.timezonePrivacyFlags);
		}
		setOptional('mfa_enabled', this.mfaEnabled);
		setOptional('authenticator_types', this.authenticatorTypes);
		setOptional('verified', this._verified);
		setOptional('hidden_profile_badges', this.hiddenProfileBadges);
		setOptional(
			'password_last_changed_at',
			this.passwordLastChangedAt === undefined ? undefined : dateToIsoOrNull(this.passwordLastChangedAt),
		);
		setOptional(
			'last_voice_activity_sharing_change_at',
			this.lastVoiceActivitySharingChangeAt === undefined
				? undefined
				: dateToIsoOrNull(this.lastVoiceActivitySharingChangeAt),
		);
		setOptional('nsfw_allowed', this._nsfwAllowed);
		setOptional('age_verified_adult', this._ageVerifiedAdult);
		setOptional(
			'terms_agreed_at',
			this._termsAgreedAt === undefined ? undefined : dateToIsoOrNull(this._termsAgreedAt),
		);
		setOptional(
			'privacy_agreed_at',
			this._privacyAgreedAt === undefined ? undefined : dateToIsoOrNull(this._privacyAgreedAt),
		);
		privateFields.traits = [...this._traits];
		setOptional('claimed', this._claimed);
		setOptional('account_tier', this._accountTier);
		setOptional('verification_need', this._verificationNeed);
		setOptional('has_password', this._hasPassword);
		return {
			...baseFields,
			...(privateFields as Partial<UserPrivate>),
		};
	}
}

function arraysShallowEqual<T>(a: ReadonlyArray<T> | undefined, b: ReadonlyArray<T> | undefined): boolean {
	if (a === b) return true;
	if (a === undefined || b === undefined) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

function datesEqual(a: Date | null | undefined, b: Date | null | undefined): boolean {
	if (a === b) return true;
	if (a == null || b == null) return a == null && b == null;
	const ta = a.getTime();
	const tb = b.getTime();
	if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.isNaN(ta) && Number.isNaN(tb);
	return ta === tb;
}
