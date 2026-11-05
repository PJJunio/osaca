// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ProfileBadgeKey, ProfileBadgeKind} from '@osaca/constants/src/BadgeConstants';
import type {ValueOf} from '@osaca/constants/src/ValueOf';

export const UNCATEGORIZED_FOLDER_ID = -1;
export const GuildFolderFlags = {
	SHOW_ICON_WHEN_COLLAPSED: 1 << 0,
} as const;
export const GuildFolderFlagsDescriptions: Record<keyof typeof GuildFolderFlags, string> = {
	SHOW_ICON_WHEN_COLLAPSED: 'Show the selected icon instead of guild previews when the folder is collapsed',
};
export const GuildFolderIcons = {
	FOLDER: 'folder',
	STAR: 'star',
	HEART: 'heart',
	BOOKMARK: 'bookmark',
	GAME_CONTROLLER: 'game_controller',
	SHIELD: 'shield',
	MUSIC_NOTE: 'music_note',
} as const;

export type GuildFolderIcon = ValueOf<typeof GuildFolderIcons>;

export const DEFAULT_GUILD_FOLDER_ICON: GuildFolderIcon = GuildFolderIcons.FOLDER;
export const UserAuthenticatorTypes = {
	TOTP: 0,
	WEBAUTHN: 2,
} as const;

export type UserAuthenticatorType = ValueOf<typeof UserAuthenticatorTypes>;

export const UserAuthenticatorTypesDescriptions: Record<keyof typeof UserAuthenticatorTypes, string> = {
	TOTP: 'Time-based one-time password authenticator',
	WEBAUTHN: 'WebAuthn authenticator',
};
export const UserFlags = {
	STAFF: 1n << 0n,
	PARTNER: 1n << 2n,
	BUG_HUNTER: 1n << 3n,
	HIGH_GLOBAL_RATE_LIMIT: 1n << 33n,
	FRIENDLY_BOT: 1n << 4n,
	FRIENDLY_BOT_MANUAL_APPROVAL: 1n << 5n,
	SPAMMER: 1n << 6n,
	PROFILE_HIDDEN: 1n << 7n,
	DELETED: 1n << 34n,
	SELF_DELETED: 1n << 36n,
	DISABLED: 1n << 38n,
	HAS_SESSION_STARTED: 1n << 39n,
	RATE_LIMIT_BYPASS: 1n << 47n,
	REPORT_BANNED: 1n << 48n,
	VERIFIED_NOT_UNDERAGE: 1n << 49n,
	ACCOUNT_LIMITED: 1n << 50n,
	APP_STORE_REVIEWER: 1n << 53n,
	AGE_VERIFIED_ADULT: 1n << 60n,
	LIMIT_EXEMPT: 1n << 62n,
} as const;
export const UserFlagsDescriptions: Record<keyof typeof UserFlags, string> = {
	STAFF: 'User is a staff member',
	PARTNER: 'User is a partner',
	BUG_HUNTER: 'User is a bug hunter',
	HIGH_GLOBAL_RATE_LIMIT: 'User has elevated global rate limits',
	FRIENDLY_BOT: 'Bot accepts friend requests from users',
	FRIENDLY_BOT_MANUAL_APPROVAL: 'Bot requires manual approval for friend requests',
	SPAMMER: 'User is flagged as a spammer',
	PROFILE_HIDDEN: 'User profile details are hidden from other users',
	DELETED: 'User account has been deleted',
	SELF_DELETED: 'User account was self-deleted',
	DISABLED: 'User account is disabled',
	HAS_SESSION_STARTED: 'User has started a session',
	RATE_LIMIT_BYPASS: 'User can bypass rate limits',
	REPORT_BANNED: 'User is banned from reporting',
	VERIFIED_NOT_UNDERAGE: 'User is verified as not underage',
	ACCOUNT_LIMITED: 'User account is limited',
	APP_STORE_REVIEWER: 'User is an app store reviewer',
	AGE_VERIFIED_ADULT: 'User has verified their age as an adult',
	LIMIT_EXEMPT: 'User is permanently exempt from account limitation',
};
const LEGACY_STAFF_HIDDEN = 1n << 57n;
const LEGACY_PREMIUM_USER_FLAGS_MASK: bigint =
	(1n << 37n) |
	(1n << 40n) |
	(1n << 41n) |
	(1n << 42n) |
	(1n << 43n) |
	(1n << 44n) |
	(1n << 45n) |
	(1n << 46n) |
	(1n << 51n);
export const LEGACY_DEAD_USER_FLAGS_MASK: bigint =
	LEGACY_PREMIUM_USER_FLAGS_MASK |
	(1n << 35n) |
	(1n << 52n) |
	(1n << 54n) |
	(1n << 55n) |
	(1n << 56n) |
	(1n << 58n) |
	(1n << 61n);
export const LEGACY_BADGE_HIDE_USER_FLAGS_MASK: bigint = LEGACY_STAFF_HIDDEN;

export function legacyHiddenProfileBadges(flags: bigint): Array<ProfileBadgeKind> {
	return (flags & LEGACY_STAFF_HIDDEN) !== 0n ? ['staff'] : [];
}

export function clearLegacyBadgeHideBits(flags: bigint): bigint {
	return flags & ~LEGACY_DEAD_USER_FLAGS_MASK & ~LEGACY_BADGE_HIDE_USER_FLAGS_MASK;
}

export const PUBLIC_USER_FLAGS =
	UserFlags.STAFF |
	UserFlags.PARTNER |
	UserFlags.BUG_HUNTER |
	UserFlags.FRIENDLY_BOT |
	UserFlags.FRIENDLY_BOT_MANUAL_APPROVAL |
	UserFlags.SPAMMER;
const HIDEABLE_FLAG_BADGES: ReadonlyArray<readonly [ProfileBadgeKind, bigint]> = [
	['staff', UserFlags.STAFF],
	['partner', UserFlags.PARTNER],
	['bug_hunter', UserFlags.BUG_HUNTER],
];

export function stripHiddenProfileBadgeFlags(flags: bigint, hiddenProfileBadges: ReadonlySet<ProfileBadgeKey>): bigint {
	let visible = flags;
	for (const [kind, flag] of HIDEABLE_FLAG_BADGES) {
		if (hiddenProfileBadges.has(kind)) visible &= ~flag;
	}
	return visible;
}
export const DELETED_USER_USERNAME = 'DeletedUser';
export const DELETED_USER_GLOBAL_NAME = 'Deleted User';
export const DELETED_USER_DISCRIMINATOR = 0;
export const DELETED_USER_ID = 1n;
export const PublicUserFlags = {
	STAFF: Number(UserFlags.STAFF),
	PARTNER: Number(UserFlags.PARTNER),
	BUG_HUNTER: Number(UserFlags.BUG_HUNTER),
	FRIENDLY_BOT: Number(UserFlags.FRIENDLY_BOT),
	FRIENDLY_BOT_MANUAL_APPROVAL: Number(UserFlags.FRIENDLY_BOT_MANUAL_APPROVAL),
	SPAMMER: Number(UserFlags.SPAMMER),
} as const;
export const PublicUserFlagsDescriptions: Record<keyof typeof PublicUserFlags, string> = {
	STAFF: 'User is a staff member',
	PARTNER: 'User is a partner',
	BUG_HUNTER: 'User is a bug hunter',
	FRIENDLY_BOT: 'Bot accepts friend requests from users',
	FRIENDLY_BOT_MANUAL_APPROVAL: 'Bot requires manual approval for friend requests',
	SPAMMER: 'User is flagged as a spammer',
};
export const ThemeTypes = {
	DARK: 'dark',
	DARK_LEGACY: 'dark_legacy',
	COAL: 'coal',
	LIGHT: 'light',
	SYSTEM: 'system',
} as const;

export type ThemeType = ValueOf<typeof ThemeTypes>;

export const TimeFormatTypes = {
	AUTO: 0,
	TWELVE_HOUR: 1,
	TWENTY_FOUR_HOUR: 2,
} as const;

export type TimeFormatType = ValueOf<typeof TimeFormatTypes>;

export const TimeFormatTypesDescriptions: Record<keyof typeof TimeFormatTypes, string> = {
	AUTO: 'Automatically detect time format based on locale',
	TWELVE_HOUR: 'Use 12-hour time format (AM/PM)',
	TWENTY_FOUR_HOUR: 'Use 24-hour time format',
};
export const StickerAnimationOptions = {
	ALWAYS_ANIMATE: 0,
	ANIMATE_ON_INTERACTION: 1,
	NEVER_ANIMATE: 2,
} as const;

export type StickerAnimationOption = ValueOf<typeof StickerAnimationOptions>;

export const StickerAnimationOptionsDescriptions: Record<keyof typeof StickerAnimationOptions, string> = {
	ALWAYS_ANIMATE: 'Always animate stickers',
	ANIMATE_ON_INTERACTION: 'Animate stickers on hover/interaction',
	NEVER_ANIMATE: 'Never animate stickers',
};
export const RenderSpoilers = {
	ALWAYS: 0,
	ON_CLICK: 1,
	IF_MODERATOR: 2,
} as const;

export type RenderSpoilersValue = ValueOf<typeof RenderSpoilers>;

export const RenderSpoilersDescriptions: Record<keyof typeof RenderSpoilers, string> = {
	ALWAYS: 'Always reveal spoiler content',
	ON_CLICK: 'Reveal spoiler content on click',
	IF_MODERATOR: 'Reveal spoiler content if moderator',
};
export const UserExplicitContentFilterTypes = {
	DISABLED: 0,
	NON_FRIENDS: 1,
	FRIENDS_AND_NON_FRIENDS: 2,
} as const;
export const SensitiveMediaFilterLevel = {
	SHOW: 0,
	BLUR: 1,
	BLOCK: 2,
} as const;

export type SensitiveMediaFilterLevelValue = ValueOf<typeof SensitiveMediaFilterLevel>;

export const SensitiveMediaFilterLevelDescriptions: Record<keyof typeof SensitiveMediaFilterLevel, string> = {
	SHOW: 'Show sensitive media without any filter',
	BLUR: 'Blur sensitive media until manually revealed',
	BLOCK: 'Completely hide sensitive media',
};
export const FriendSourceFlags = {
	MUTUAL_FRIENDS: 1 << 0,
	MUTUAL_GUILDS: 1 << 1,
	NO_RELATION: 1 << 2,
} as const;
export const FriendSourceFlagsDescriptions: Record<keyof typeof FriendSourceFlags, string> = {
	MUTUAL_FRIENDS: 'Allow friend requests from users who share mutual friends',
	MUTUAL_GUILDS: 'Allow friend requests from users in mutual guilds',
	NO_RELATION: 'Allow friend requests from users with no existing relation',
};
export const IncomingCallFlags = {
	FRIENDS_OF_FRIENDS: 1 << 0,
	GUILD_MEMBERS: 1 << 1,
	EVERYONE: 1 << 2,
	FRIENDS_ONLY: 1 << 3,
	NOBODY: 1 << 4,
	SILENT_EVERYONE: 1 << 5,
} as const;
export const IncomingCallFlagsDescriptions: Record<keyof typeof IncomingCallFlags, string> = {
	FRIENDS_OF_FRIENDS: 'Allow incoming calls from friends of friends',
	GUILD_MEMBERS: 'Allow incoming calls from guild members',
	EVERYONE: 'Allow incoming calls from everyone',
	FRIENDS_ONLY: 'Allow incoming calls only from friends',
	NOBODY: 'Block all incoming calls',
	SILENT_EVERYONE: 'Allow calls from everyone but receive them silently',
};
export const GroupDmAddPermissionFlags = {
	FRIENDS_OF_FRIENDS: 1 << 0,
	GUILD_MEMBERS: 1 << 1,
	EVERYONE: 1 << 2,
	FRIENDS_ONLY: 1 << 3,
	NOBODY: 1 << 4,
} as const;
export const GroupDmAddPermissionFlagsDescriptions: Record<keyof typeof GroupDmAddPermissionFlags, string> = {
	FRIENDS_OF_FRIENDS: 'Allow friends of friends to add user to group DMs',
	GUILD_MEMBERS: 'Allow guild members to add user to group DMs',
	EVERYONE: 'Allow everyone to add user to group DMs',
	FRIENDS_ONLY: 'Allow only friends to add user to group DMs',
	NOBODY: 'Block everyone from adding user to group DMs',
};
export const ProfilePrivacyLevels = {
	ALL_GUILDS: 0,
	SMALL_GUILDS_ONLY: 1,
	FRIENDS_ONLY: 2,
} as const;

export type ProfilePrivacyLevel = (typeof ProfilePrivacyLevels)[keyof typeof ProfilePrivacyLevels];

export const ProfilePrivacyLevelsDescriptions: Record<keyof typeof ProfilePrivacyLevels, string> = {
	ALL_GUILDS: 'Profile visible to friends and members of any shared guild',
	SMALL_GUILDS_ONLY: 'Profile visible to friends and members of shared guilds with at most 200 members',
	FRIENDS_ONLY: 'Profile visible only to friends',
};
export const ProfileFieldPrivacyFlags = {
	EVERYONE: 1 << 0,
	FRIENDS: 1 << 1,
	MUTUAL_GUILDS: 1 << 2,
} as const;

export const ProfileFieldPrivacyFlagsDescriptions: Record<keyof typeof ProfileFieldPrivacyFlags, string> = {
	EVERYONE: 'Allow anyone who can view the full profile to see this profile field',
	FRIENDS: 'Allow friends to see this profile field',
	MUTUAL_GUILDS: 'Allow members from mutual guilds to see this profile field',
};
export const SMALL_GUILD_MEMBER_THRESHOLD = 200;
export const VOICE_ACTIVITY_SHARING_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const UserNotificationSettings = {
	ALL_MESSAGES: 0,
	ONLY_MENTIONS: 1,
	NO_MESSAGES: 2,
	INHERIT: 3,
} as const;

export const UserNotificationSettingsDescriptions: Record<keyof typeof UserNotificationSettings, string> = {
	ALL_MESSAGES: 'Receive notifications for all messages',
	ONLY_MENTIONS: 'Only receive notifications for mentions',
	NO_MESSAGES: 'Do not receive any notifications',
	INHERIT: 'Inherit notification settings from parent',
};
export const MentionReplyPreferences = {
	NO_PREFERENCE: 0,
	PREFER_MENTION: 1,
	PREFER_NO_MENTION: 2,
} as const;

export type MentionReplyPreference = ValueOf<typeof MentionReplyPreferences>;

export const MentionReplyPreferencesDescriptions: Record<keyof typeof MentionReplyPreferences, string> = {
	NO_PREFERENCE:
		'Respect the sender intent on each reply, with no warning when toggling the @ mention. On a guild member, inherits the value from the user-level preference.',
	PREFER_MENTION: 'Default replies to @mention this user, and warn the sender when they disable the mention',
	PREFER_NO_MENTION: 'Default replies to omit the @mention for this user, and warn the sender when they enable it',
};
export const RelationshipTypes = {
	FRIEND: 1,
	BLOCKED: 2,
	INCOMING_REQUEST: 3,
	OUTGOING_REQUEST: 4,
} as const;

export type RelationshipType = ValueOf<typeof RelationshipTypes>;

export const RelationshipTypesDescriptions: Record<keyof typeof RelationshipTypes, string> = {
	FRIEND: 'User is a friend',
	BLOCKED: 'User is blocked',
	INCOMING_REQUEST: 'Pending incoming friend request',
	OUTGOING_REQUEST: 'Pending outgoing friend request',
};
