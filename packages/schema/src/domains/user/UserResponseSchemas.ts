// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AccountTier, AccountVerificationNeed} from '@osaca/constants/src/AccountTierConstants';
import {
	DEFAULT_GUILD_FOLDER_ICON,
	FriendSourceFlags,
	FriendSourceFlagsDescriptions,
	GroupDmAddPermissionFlags,
	GroupDmAddPermissionFlagsDescriptions,
	GuildFolderFlags,
	GuildFolderFlagsDescriptions,
	IncomingCallFlags,
	IncomingCallFlagsDescriptions,
	type MentionReplyPreference,
	ProfileFieldPrivacyFlags,
	ProfileFieldPrivacyFlagsDescriptions,
	PublicUserFlags,
	PublicUserFlagsDescriptions,
} from '@osaca/constants/src/UserConstants';
import {AccountTierSchema, AccountVerificationNeedSchema} from '@osaca/schema/src/domains/account/AccountTierSchemas';
import {ConnectionResponse} from '@osaca/schema/src/domains/connection/ConnectionSchemas';
import {GuildMemberResponse} from '@osaca/schema/src/domains/guild/GuildMemberSchemas';
import {MessageResponseSchema} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import {ProfileBadgeListResponse} from '@osaca/schema/src/domains/user/ProfileBadgeSchemas';
import {LocaleSchema} from '@osaca/schema/src/primitives/LocaleSchema';
import {
	createBitflagInt32Type,
	createNamedStringLiteralUnion,
	HexString32Type,
	Int32Type,
	SignedInt32Type,
	SnowflakeStringType,
	withFieldDescription,
	withOpenApiType,
} from '@osaca/schema/src/primitives/SchemaPrimitives';
import {
	GuildFolderIconSchema,
	MentionReplyPreferencesSchema,
	ProfilePrivacyLevelSchema,
	RelationshipTypesSchema,
	RenderSpoilersSchema,
	SensitiveMediaFilterLevelSchema,
	SensitiveMediaGuildFilterLevelSchema,
	StickerAnimationOptionsSchema,
	TimeFormatTypesSchema,
	UserAuthenticatorTypesSchema,
	UserNotificationSettingsSchema,
} from '@osaca/schema/src/primitives/UserSettingsValidators';
import {z} from 'zod';

export const UserPartialResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier (snowflake) for this user'),
	username: z.string().describe('The username of the user, not unique across the platform'),
	discriminator: z.string().describe('The four-digit discriminator tag of the user'),
	global_name: z.string().nullable().describe('The display name of the user, if set'),
	avatar: z.string().nullable().describe('The hash of the user avatar image'),
	avatar_color: Int32Type.nullable().describe('The dominant avatar color of the user as an integer'),
	bot: z.boolean().optional().describe('Whether the user is a bot account'),
	system: z.boolean().optional().describe('Whether the user is an official system user'),
	flags: createBitflagInt32Type(
		PublicUserFlags,
		PublicUserFlagsDescriptions,
		'The public flags on the user account',
		'PublicUserFlags',
	),
	mention_flags: withFieldDescription(MentionReplyPreferencesSchema, "The user's account-wide reply mention preference")
		.optional()
		.describe(
			"The user's account-wide reply mention preference. Omitted when the user has no preference set (treated as NO_PREFERENCE).",
		),
});

export type UserPartialResponse = z.infer<typeof UserPartialResponse>;

export const UserPrivateResponse = UserPartialResponse.extend({
	is_staff: z.boolean().describe('Whether the user has staff permissions'),
	acls: z.array(z.string()).describe('Access control list entries for the user'),
	traits: z.array(z.string()).describe('Special traits assigned to the user account'),
	has_verified_phone: z.boolean().describe('Deprecated. Always false.'),
	bio: z.string().nullable().describe('The user biography text'),
	pronouns: z.string().nullable().describe('The preferred pronouns of the user'),
	accent_color: Int32Type.nullable().describe('The user-selected accent color as an integer'),
	timezone: z.string().nullable().optional().describe('The IANA timezone identifier saved by the user'),
	timezone_privacy_flags: createBitflagInt32Type(
		ProfileFieldPrivacyFlags,
		ProfileFieldPrivacyFlagsDescriptions,
		'Bitfield controlling who can see the profile timezone',
		'ProfileFieldPrivacyFlags',
	)
		.optional()
		.describe('Bitfield controlling who can see the profile timezone'),
	banner: z.string().nullable().describe('The hash of the user profile banner image'),
	banner_color: Int32Type.nullable().describe('The default banner color if no custom banner is set'),
	mfa_enabled: z.boolean().describe('Whether multi-factor authentication is enabled'),
	authenticator_types: z
		.array(UserAuthenticatorTypesSchema)
		.optional()
		.describe('The types of authenticators configured for MFA'),
	account_limited: z.boolean().optional().describe('Whether the account is limited'),
	hidden_profile_badges: z
		.array(z.string())
		.describe('Keys of the badges hidden from other people, as in the key field of a profile badge'),
	password_last_changed_at: z.string().nullable().describe('ISO8601 timestamp of the last password change'),
	last_voice_activity_sharing_change_at: z
		.string()
		.nullable()
		.describe(
			'ISO8601 timestamp of the last bulk voice-activity-sharing change. Drives the 24-hour cooldown for re-toggling the Active Now sharing default.',
		),
	required_actions: z.array(z.string()).describe('Deprecated. Always empty.'),
	nsfw_allowed: z.boolean().describe('Whether the user is allowed to view NSFW content'),
	pending_bulk_message_deletion: z
		.object({
			scheduled_at: z.string().describe('ISO8601 timestamp of when the deletion was scheduled'),
			channel_count: Int32Type.describe('The number of channels with messages to delete'),
			message_count: Int32Type.describe('The total number of messages to delete'),
		})
		.nullable()
		.describe(
			'Information about a pending bulk message deletion request. Only populated when the legacy delayed-deletion flow is in progress; the new immediate-deletion flow does not surface a pending state here.',
		),
	age_verified_adult: z.boolean().optional().describe('Whether the user has verified their age as an adult'),
	terms_agreed_at: z
		.string()
		.nullable()
		.describe('ISO8601 timestamp of when the user last agreed to the terms of service'),
	privacy_agreed_at: z
		.string()
		.nullable()
		.describe(
			'ISO8601 timestamp of when the user was last shown the current privacy policy. People are informed of it, they do not agree to it',
		),
	claimed: z
		.boolean()
		.optional()
		.describe(
			'Whether the account can be signed in to again from another device, because it has a password or passkey',
		),
	account_tier: AccountTierSchema.optional().describe(
		'How far the account has got with setting up a way to sign in. Clients that do not get it derive it from claimed',
	),
	verification_need: AccountVerificationNeedSchema.nullable()
		.optional()
		.describe('What the account still has to do before it can use everything, null once it is verified'),
	has_password: z.boolean().optional().describe('Whether the account has a password'),
	profile_restricted: z
		.boolean()
		.optional()
		.describe('Whether other people see only the username of this account until it has a password or passkey'),
});

export type UserPrivateResponse = z.infer<typeof UserPrivateResponse>;

export const UserUpdateResponse = UserPrivateResponse.extend({
	token: z
		.string()
		.optional()
		.describe('Authentication token for the replacement session, present when the password was changed'),
	auth_session_id_hash: z
		.string()
		.optional()
		.describe(
			'Base64url-encoded hash of the replacement authentication session, present when the password was changed',
		),
});

export type UserUpdateResponse = z.infer<typeof UserUpdateResponse>;

export const UserPasswordUpdateResponse = z.object({
	token: z.string().describe('Authentication token for the newly created session'),
	auth_session_id_hash: z.string().describe('Base64url-encoded hash of the newly created authentication session'),
});

export type UserPasswordUpdateResponse = z.infer<typeof UserPasswordUpdateResponse>;

export const RecoveryKitStatusResponse = z.object({
	has_recovery_kit: z.boolean().describe('Whether the account has a recovery kit'),
	created_at: z.iso.datetime().nullable().describe('ISO 8601 timestamp when the current recovery kit was created'),
});

export type RecoveryKitStatusResponse = z.infer<typeof RecoveryKitStatusResponse>;

export const RecoveryKitCreateResponse = z.object({
	recovery_key: z
		.string()
		.describe('New recovery key as 8 groups of 4 joined by dashes, shown only once. Any previous kit stops working'),
	created_at: z.iso.datetime().describe('ISO 8601 timestamp when the recovery kit was created'),
});

export type RecoveryKitCreateResponse = z.infer<typeof RecoveryKitCreateResponse>;

export interface UserProfileResponse {
	bio: string | null;
	pronouns: string | null;
	banner: string | null;
	banner_color?: number | null;
	accent_color: number | null;
}

export const CustomStatusResponse = z.object({
	text: z.string().nullish().describe('The custom status message text'),
	expires_at: z.iso.datetime().nullish().describe('ISO8601 timestamp of when the custom status expires'),
	emoji_id: SnowflakeStringType.nullish().describe('The ID of the custom emoji used in the status'),
	emoji_name: z.string().nullish().describe('The name of the emoji used in the status'),
	emoji_animated: z.boolean().describe('Whether the status emoji is animated'),
});

export type CustomStatusResponse = z.infer<typeof CustomStatusResponse>;

export const UserSettingsResponse = z.object({
	status: z.string().describe('The current online status of the user'),
	status_resets_at: z.iso.datetime().nullish().describe('ISO8601 timestamp of when the status will reset'),
	status_resets_to: z.string().nullish().describe('The status to reset to after the scheduled reset'),
	theme: z.string().describe('The UI theme preference'),
	locale: LocaleSchema,
	restricted_guilds: z.array(SnowflakeStringType).describe('Guild IDs where direct messages are restricted'),
	bot_restricted_guilds: z.array(SnowflakeStringType).describe('Guild IDs where bot direct messages are restricted'),
	default_guilds_restricted: z.boolean().describe('Whether new guilds have DM restrictions by default'),
	bot_default_guilds_restricted: z.boolean().describe('Whether new guilds have bot DM restrictions by default'),
	inline_attachment_media: z.boolean().describe('Whether to display attachments inline in chat'),
	inline_embed_media: z.boolean().describe('Whether to display embed media inline in chat'),
	gif_auto_play: z.boolean().describe('Whether GIFs auto-play in chat'),
	render_embeds: z.boolean().describe('Whether to render message embeds'),
	render_reactions: z.boolean().describe('Whether to display reactions on messages'),
	animate_emoji: z.boolean().describe('Whether to animate custom emoji'),
	animate_stickers: withFieldDescription(StickerAnimationOptionsSchema, 'Sticker animation preference setting'),
	render_spoilers: withFieldDescription(RenderSpoilersSchema, 'Spoiler rendering preference setting'),
	message_display_compact: z.boolean().describe('Whether to use compact message display mode'),
	friend_source_flags: createBitflagInt32Type(
		FriendSourceFlags,
		FriendSourceFlagsDescriptions,
		'Bitfield for friend request source permissions',
		'FriendSourceFlags',
	),
	incoming_call_flags: createBitflagInt32Type(
		IncomingCallFlags,
		IncomingCallFlagsDescriptions,
		'Bitfield for incoming call notification settings',
		'IncomingCallFlags',
	),
	group_dm_add_permission_flags: createBitflagInt32Type(
		GroupDmAddPermissionFlags,
		GroupDmAddPermissionFlagsDescriptions,
		'Bitfield for group DM add permissions',
		'GroupDmAddPermissionFlags',
	),
	guild_folders: z
		.array(
			z.object({
				id: SignedInt32Type.nullish().describe('The unique identifier for the folder (-1 for uncategorized)'),
				name: z.string().nullish().describe('The display name of the folder'),
				color: Int32Type.nullish().describe('The color of the folder as an integer'),
				flags: createBitflagInt32Type(
					GuildFolderFlags,
					GuildFolderFlagsDescriptions,
					'Bitfield for guild folder display behaviour',
					'GuildFolderFlags',
				)
					.default(0)
					.describe('Bitfield for guild folder display behaviour'),
				icon: GuildFolderIconSchema.default(DEFAULT_GUILD_FOLDER_ICON).describe('Selected icon for the guild folder'),
				guild_ids: z.array(SnowflakeStringType).describe('The IDs of guilds contained in this folder'),
			}),
		)
		.describe('The folder structure for organizing guilds in the sidebar'),
	custom_status: CustomStatusResponse.nullable().describe('The custom status set by the user'),
	afk_timeout: Int32Type.describe('The idle timeout in seconds before going AFK'),
	time_format: withFieldDescription(TimeFormatTypesSchema, 'The preferred time format setting'),
	developer_mode: z.boolean().describe('Whether developer mode is enabled'),
	trusted_domains: z.array(z.string()).describe('List of trusted external link domains'),
	default_hide_muted_channels: z.boolean().describe('Whether muted channels are hidden by default in new guilds'),
	sensitive_content_friend_dm_filter: withFieldDescription(
		SensitiveMediaFilterLevelSchema,
		'Sensitive media filter level for DMs from friends',
	),
	sensitive_content_non_friend_dm_filter: withFieldDescription(
		SensitiveMediaFilterLevelSchema,
		'Sensitive media filter level for DMs from non-friends',
	),
	sensitive_content_guild_filter: withFieldDescription(
		SensitiveMediaGuildFilterLevelSchema,
		'Sensitive media filter level for community channels',
	),
	suppress_unprivileged_self_mentions: z
		.boolean()
		.describe('Whether direct mentions and reply mentions from unprivileged users are suppressed'),
	suppress_unprivileged_self_mentions_bypass_user_ids: z
		.array(SnowflakeStringType)
		.describe('User IDs that bypass self-mention suppression'),
	staff_dm_access_user_ids: z.array(SnowflakeStringType).describe('User IDs with Staff DM Access enabled'),
	synced_preferences: z
		.string()
		.describe(
			'Account-wide client preferences as a base64-encoded protobuf snapshot. Empty string when nothing has been synced yet.',
		),
	profile_privacy: withFieldDescription(
		ProfilePrivacyLevelSchema,
		'Controls who sees the full profile: all guild members, only small-guild members, or only friends',
	),
	default_share_voice_activity: z
		.boolean()
		.describe(
			'Default value of share_voice_activity applied to newly accepted friend relationships. Read-only here; mutated via PUT /users/@me/settings/voice-activity-sharing.',
		),
	privacy_setup_version: z
		.number()
		.int()
		.describe('Latest privacy setup version the user has reviewed, 0 if never reviewed'),
	privacy_setup_completed_at: z.iso
		.datetime()
		.nullable()
		.describe('When the user last completed the privacy setup, or null if never'),
});

export type UserSettingsResponse = z.infer<typeof UserSettingsResponse>;

const UserGuildMuteConfig = z
	.object({
		end_time: z.string().nullable().describe('ISO8601 timestamp of when the mute expires'),
		selected_time_window: Int32Type.describe('The selected mute duration in seconds'),
	})
	.nullable();
const UserGuildChannelOverride = z.object({
	collapsed: z.boolean().describe('Whether the channel category is collapsed in the sidebar'),
	message_notifications: withFieldDescription(
		UserNotificationSettingsSchema,
		'The notification level override for this channel',
	),
	muted: z.boolean().describe('Whether notifications are muted for this channel'),
	mute_config: UserGuildMuteConfig.describe('The mute configuration for this channel'),
	unread_badges: withFieldDescription(UserNotificationSettingsSchema, 'Unread badges level override for this channel')
		.nullish()
		.describe('Unread badges level override for this channel (null = inherit)'),
	flags: Int32Type.optional().describe(
		'Channel override flags (NEW_FORUM_THREADS_OFF 1<<13, NEW_FORUM_THREADS_ON 1<<14)',
	),
});
export const UserGuildSettingsResponse = z.object({
	guild_id: SnowflakeStringType.nullable().describe('The ID of the guild these settings apply to'),
	message_notifications: withFieldDescription(
		UserNotificationSettingsSchema,
		'The default notification level for the guild',
	),
	muted: z.boolean().describe('Whether the guild is muted'),
	mute_config: UserGuildMuteConfig.describe('The mute configuration for the guild'),
	mobile_push: z.boolean().describe('Whether mobile push notifications are enabled'),
	suppress_everyone: z.boolean().describe('Whether @everyone mentions are suppressed'),
	suppress_roles: z.boolean().describe('Whether role mentions are suppressed'),
	hide_muted_channels: z.boolean().describe('Whether muted channels are hidden in the sidebar'),
	channel_overrides: z
		.record(SnowflakeStringType, UserGuildChannelOverride)
		.nullable()
		.describe('Per-channel notification overrides'),
	unread_badges: withFieldDescription(UserNotificationSettingsSchema, 'Default unread badges level for the guild')
		.nullish()
		.describe('Default unread badges level for the guild (null = follows message_notifications)'),
	version: Int32Type.describe('The version number of these settings for sync'),
});

export type UserGuildSettingsResponse = z.infer<typeof UserGuildSettingsResponse>;

export const RelationshipResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for the relationship'),
	type: withFieldDescription(RelationshipTypesSchema, 'The type of relationship (friend, blocked, pending, etc.)'),
	user: z.lazy(() => UserPartialResponse).describe('The user involved in this relationship'),
	since: z.iso.datetime().optional().describe('ISO8601 timestamp of when the relationship was established'),
	nickname: z.string().nullable().describe('A custom nickname set for the related user'),
	share_voice_activity: z
		.boolean()
		.describe(
			'Whether the current user has chosen to share their voice activity with this friend on the Active Now panel',
		),
	friend_shares_voice_activity: z
		.boolean()
		.describe(
			'Whether this friend has chosen to share their voice activity with the current user; for non-friend types this is always true',
		),
});

export type RelationshipResponse = z.infer<typeof RelationshipResponse>;
export interface BackupCode {
	readonly code: string;
	readonly consumed: boolean;
}

interface PendingBulkMessageDeletion {
	readonly scheduled_at: string;
	readonly channel_count: number;
	readonly message_count: number;
}

export type UserProfile = Readonly<UserProfileResponse>;

export interface UserPartial {
	readonly id: string;
	readonly username: string;
	readonly discriminator: string;
	readonly global_name: string | null;
	readonly avatar: string | null;
	readonly avatar_color: number | null;
	readonly bot?: boolean;
	readonly system?: boolean;
	readonly flags: number;
	readonly mention_flags?: MentionReplyPreference;
}

export interface UserPrivate extends UserPartial, UserProfile {
	readonly is_staff: boolean;
	readonly mfa_enabled: boolean;
	readonly has_verified_phone: boolean;
	readonly authenticator_types: ReadonlyArray<number>;
	readonly account_limited?: boolean;
	readonly hidden_profile_badges?: ReadonlyArray<string>;
	readonly timezone?: string | null;
	readonly timezone_privacy_flags?: number;
	readonly password_last_changed_at: string | null;
	readonly last_voice_activity_sharing_change_at: string | null;
	readonly required_actions: ReadonlyArray<string>;
	readonly nsfw_allowed: boolean;
	readonly pending_bulk_message_deletion: PendingBulkMessageDeletion | null;
	readonly age_verified_adult?: boolean;
	readonly terms_agreed_at?: string | null;
	readonly privacy_agreed_at?: string | null;
	readonly traits: ReadonlyArray<string>;
	readonly claimed?: boolean;
	readonly account_tier?: AccountTier;
	readonly verification_need?: AccountVerificationNeed | null;
	readonly has_password?: boolean;
	readonly profile_restricted?: boolean;
}

export type User = UserPartial & Partial<UserPrivate>;

export const SavedMessageStatusSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['available', 'Available', 'The saved message is available and can be retrieved'],
			['missing_permissions', 'Missing Permissions', 'The user no longer has permission to view the message'],
		],
		'Availability status of a saved message',
	),
	'SavedMessageStatus',
);

export type SavedMessageStatus = z.infer<typeof SavedMessageStatusSchema>;

export const SavedMessageEntryResponse = z.object({
	id: SnowflakeStringType.describe('Unique identifier for the saved message entry'),
	channel_id: SnowflakeStringType.describe('ID of the channel containing the message'),
	message_id: SnowflakeStringType.describe('ID of the saved message'),
	status: SavedMessageStatusSchema.describe('Availability status of the saved message'),
	message: z
		.lazy(() => MessageResponseSchema)
		.nullable()
		.describe('The message content if available'),
});

export type SavedMessageEntryResponse = z.infer<typeof SavedMessageEntryResponse>;

export const SavedMessageEntryListResponse = z.array(SavedMessageEntryResponse);

export type SavedMessageEntryListResponse = z.infer<typeof SavedMessageEntryListResponse>;

export const UserTagCheckResponse = z.object({
	taken: z.boolean().describe('Whether the username/discriminator combination is already taken'),
});

export type UserTagCheckResponse = z.infer<typeof UserTagCheckResponse>;

const UserProfileDataResponse = z.object({
	bio: z.string().nullable().describe('User biography text'),
	pronouns: z.string().nullable().describe('User pronouns'),
	banner: z.string().nullable().describe('Hash of the profile banner image'),
	banner_color: Int32Type.nullable().optional().describe('Default banner color if no custom banner'),
	accent_color: Int32Type.nullable().describe('User-selected accent color'),
});

const GuildMemberProfileDataResponse = z
	.object({
		bio: z.string().nullable().describe('Guild-specific biography text'),
		pronouns: z.string().nullable().describe('Guild-specific pronouns'),
		banner: z.string().nullable().describe('Hash of the guild-specific banner image'),
		accent_color: Int32Type.nullable().describe('Guild-specific accent color'),
	})
	.nullable()
	.optional();

const MutualGuildResponse = z.object({
	id: SnowflakeStringType.describe('The ID of the mutual guild'),
	nick: z.string().nullable().describe('The nickname of the target user in this guild'),
});

export const UserProfileFullResponse = z.object({
	user: UserPartialResponse.describe('The user object'),
	user_profile: UserProfileDataResponse.describe('The user profile data'),
	guild_member: z
		.lazy(() => GuildMemberResponse)
		.optional()
		.describe('The guild member data if guild_id was provided'),
	guild_member_profile: GuildMemberProfileDataResponse.describe('Guild-specific profile data'),
	profile_badges: ProfileBadgeListResponse.optional().describe(
		'Profile badges in display order. Empty when there is nothing to show. Older servers omit it',
	),
	hidden_profile_badge_count: z
		.number()
		.int()
		.optional()
		.describe('How many of the badges you hold are hidden from other people. Only present on your own profile'),
	mutual_friends: z.array(UserPartialResponse).optional().describe('Array of mutual friends'),
	mutual_guilds: z.array(MutualGuildResponse).optional().describe('Array of mutual guilds'),
	connected_accounts: z.array(ConnectionResponse).optional().describe('Array of verified external connections'),
	timezone_offset: SignedInt32Type.nullable().describe(
		"Current timezone offset in minutes from UTC for the target user's profile timezone, or null when hidden or unset",
	),
	profile_limited: z
		.boolean()
		.optional()
		.describe(
			'True when the target user has restricted their profile and the viewer does not meet the visibility tier. Bio, pronouns and connected accounts have been stripped. Staff, partner, and bug hunter badges remain.',
		),
});

export type UserProfileFullResponse = z.infer<typeof UserProfileFullResponse>;

export const UserNotesRecordResponse = z
	.record(SnowflakeStringType, z.string())
	.describe('A map of user IDs to note text');

export type UserNotesRecordResponse = z.infer<typeof UserNotesRecordResponse>;

export const UserNoteResponse = z.object({
	note: z.string().describe('The note text for this user'),
});

export type UserNoteResponse = z.infer<typeof UserNoteResponse>;

export const RegisterMobileDeviceResponse = z.object({
	device_id: HexString32Type.describe('The unique identifier for the registered device'),
});

export type RegisterMobileDeviceResponse = z.infer<typeof RegisterMobileDeviceResponse>;

const MobileDeviceItemResponse = z.object({
	device_id: HexString32Type.describe('The unique identifier for the device'),
	platform: z.string().describe('The mobile push notification platform'),
	app_id: z.string().nullable().describe('Client app channel or bundle mapping identifier for this device'),
	provider_environment: z.string().nullable().describe('Push provider environment used for this device'),
	user_agent: z.string().nullable().describe('The user agent that registered this device'),
});

export const MobileDevicesListResponse = z.object({
	devices: z.array(MobileDeviceItemResponse).describe('Array of registered mobile push devices'),
});

export type MobileDevicesListResponse = z.infer<typeof MobileDevicesListResponse>;

export const PreloadMessagesResponse = z
	.record(SnowflakeStringType, z.lazy(() => MessageResponseSchema).nullable())
	.describe('A map of channel IDs to the latest message in each channel');

export type PreloadMessagesResponse = z.infer<typeof PreloadMessagesResponse>;

export const PushSubscribeResponse = z.object({
	subscription_id: z.string().describe('The unique identifier for the push subscription'),
});

export type PushSubscribeResponse = z.infer<typeof PushSubscribeResponse>;

const PushSubscriptionItemResponse = z.object({
	subscription_id: z.string().describe('The unique identifier for the push subscription'),
	user_agent: z.string().nullable().describe('The user agent that created this subscription'),
});

export const PushSubscriptionsListResponse = z.object({
	subscriptions: z.array(PushSubscriptionItemResponse).describe('Array of push notification subscriptions'),
});

export type PushSubscriptionsListResponse = z.infer<typeof PushSubscriptionsListResponse>;

export const BulkIgnoreFriendRequestsResponse = z.object({
	ignored_count: z.number().int(),
});

export type BulkIgnoreFriendRequestsResponse = z.infer<typeof BulkIgnoreFriendRequestsResponse>;

export const RelationshipListResponse = z.array(RelationshipResponse);
