// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {UserConnectionRow} from '@app/api/database/types/ConnectionTypes';
import type {Application} from '@app/api/models/Application';
import type {AuthSession} from '@app/api/models/AuthSession';
import type {Channel} from '@app/api/models/Channel';
import type {FavoriteMeme} from '@app/api/models/FavoriteMeme';
import type {Guild} from '@app/api/models/Guild';
import type {GuildMember} from '@app/api/models/GuildMember';
import type {MfaBackupCode} from '@app/api/models/MfaBackupCode';
import type {PushSubscription} from '@app/api/models/PushSubscription';
import type {Relationship} from '@app/api/models/Relationship';
import type {SavedMessage} from '@app/api/models/SavedMessage';
import type {ThreadMember} from '@app/api/models/ThreadMember';
import type {User} from '@app/api/models/User';
import type {UserGuildSettings} from '@app/api/models/UserGuildSettings';
import type {UserSettings} from '@app/api/models/UserSettings';
import type {WebAuthnCredential} from '@app/api/models/WebAuthnCredential';
import {resolveSessionClientInfo} from '@app/api/utils/SessionClientIdentity';
import {getAnimatedAssetExtension} from '@app/api/worker/utils/AssetArchiveHelpers';
import {
	decodeSyncedPreferencesLenient,
	syncedPreferencesToJson,
} from '@osaca/schema/src/domains/user/SyncedPreferencesCodec';
import {snowflakeToDate} from '@osaca/snowflake/src/Snowflake';

interface GuildMembershipEntry {
	member: GuildMember | null;
	guild: Guild | null;
	guildId: GuildID;
}

interface ArchivedUserSettings {
	locale: UserSettings['locale'];
	theme: string;
	status: string;
	custom_status: {
		text: string | null;
		emoji_id: string | null;
		emoji_name: string | null;
		emoji_animated: boolean;
		expires_at: string | null;
	} | null;
	developer_mode: boolean;
	message_display_compact: boolean;
	animate_emoji: boolean;
	animate_stickers: UserSettings['animateStickers'];
	gif_auto_play: boolean;
	render_embeds: boolean;
	render_reactions: boolean;
	render_spoilers: UserSettings['renderSpoilers'];
	inline_attachment_media: boolean;
	inline_embed_media: boolean;
	explicit_content_filter: number;
	friend_source_flags: number;
	default_guilds_restricted: boolean;
	bot_default_guilds_restricted: boolean;
	restricted_guilds: Array<string>;
	bot_restricted_guilds: Array<string>;
	guild_positions: Array<string>;
	guild_folders: Array<{
		id: number;
		name: string | null;
		color: number | null;
		flags: number;
		icon: UserSettings['guildFolders'][number]['icon'];
		guild_ids: Array<string>;
	}>;
	afk_timeout: number;
	time_format: UserSettings['timeFormat'];
	suppress_unprivileged_self_mentions: boolean;
	suppress_unprivileged_self_mentions_bypass_user_ids: Array<string>;
	staff_dm_access_user_ids: Array<string>;
	synced_preferences: unknown;
	profile_privacy: UserSettings['profilePrivacy'];
	privacy_setup_version: number;
	privacy_setup_completed_at: string | null;
}

interface UserDataJsonParams {
	user: User;
	userId: UserID;
	productName: string;
	authSessions: Array<AuthSession>;
	relationships: Array<Relationship>;
	userNotes: Map<UserID, string>;
	userSettings: UserSettings | null;
	guildMemberships: Array<GuildMembershipEntry>;
	guildSettings: Array<UserGuildSettings | null>;
	threadMemberships: Array<ThreadMember>;
	savedMessages: Array<SavedMessage>;
	privateChannels: Array<Channel>;
	favoriteMemes: Array<FavoriteMeme>;
	pushSubscriptions: Array<PushSubscription>;
	webAuthnCredentials: Array<WebAuthnCredential>;
	mfaBackupCodes: Array<MfaBackupCode>;
	recoveryKitCreatedAt: Date | null;
	oauthClients: Array<Application>;
	connections: Array<UserConnectionRow>;
	pinnedDms: Array<{
		channel_id: bigint;
		sort_order: number;
	}>;
	authorizedIps: Array<{
		ip: string;
	}>;
	activityData: {
		last_active_at: Date | null;
		last_active_ip: string | null;
	};
}

export function mapOAuthApplication(app: Application) {
	return {
		application_id: app.applicationId.toString(),
		name: app.name,
		redirect_uris: Array.from(app.oauth2RedirectUris),
	};
}

export function mapSecurityData(params: {
	authorizedIps: Array<{
		ip: string;
	}>;
	activityData: {
		last_active_at: Date | null;
		last_active_ip: string | null;
	};
}) {
	return {
		authorized_ips: params.authorizedIps,
		activity_tracking: {
			last_active_at: params.activityData.last_active_at?.toISOString() ?? null,
			last_active_ip: params.activityData.last_active_ip,
		},
	};
}

export function buildUserDataJson(params: UserDataJsonParams) {
	const {
		user,
		userId,
		productName,
		authSessions,
		relationships,
		userNotes,
		userSettings,
		guildMemberships,
		guildSettings,
		threadMemberships,
		savedMessages,
		privateChannels,
		favoriteMemes,
		pushSubscriptions,
		webAuthnCredentials,
		mfaBackupCodes,
		recoveryKitCreatedAt,
		oauthClients,
		connections,
		pinnedDms,
		authorizedIps,
		activityData,
	} = params;
	const responseFields = {
		user: {
			id: user.id.toString(),
			username: user.username,
			discriminator: user.discriminator,
			bot: user.isBot,
			system: user.isSystem,
			email: user.email,
			email_verified: user.emailVerified,
			email_bounced: user.emailBounced,
			avatar_hash: user.avatarHash,
			avatar_url: user.avatarHash
				? `${Config.endpoints.media}/avatars/${userId}/${user.avatarHash}.${getAnimatedAssetExtension(user.avatarHash)}`
				: null,
			banner_hash: user.bannerHash,
			banner_url: user.bannerHash
				? `${Config.endpoints.media}/banners/${userId}/${user.bannerHash}.${getAnimatedAssetExtension(user.bannerHash)}`
				: null,
			bio: user.bio,
			pronouns: user.pronouns,
			accent_color: user.accentColor,
			locale: user.locale,
			flags: user.flags.toString(),
			terms_agreed_at: user.termsAgreedAt?.toISOString() ?? null,
			privacy_agreed_at: user.privacyAgreedAt?.toISOString() ?? null,
			last_active_at: user.lastActiveAt?.toISOString() ?? null,
			created_at: snowflakeToDate(user.id).toISOString(),
			mfa_enabled: user.authenticatorTypes.size > 0,
			authenticator_types: Array.from(user.authenticatorTypes),
		},
		auth_sessions: authSessions.map((session) => {
			const clientInfo = resolveSessionClientInfo({
				userAgent: session.clientUserAgent,
				reportedOs: session.clientOs ?? null,
				productName,
			});
			return {
				created_at: session.createdAt.toISOString(),
				approx_last_used_at: session.approximateLastUsedAt?.toISOString() ?? null,
				client_ip: session.clientIp,
				client_os: clientInfo.os,
				client_user_agent: session.clientUserAgent,
				client_platform: clientInfo.platform,
				app_platform: session.appPlatform,
				app_version: session.appVersion,
				app_release_channel: session.appReleaseChannel,
				app_build_number: session.appBuildNumber,
				app_beta_number: session.appBetaNumber,
			};
		}),
		relationships: relationships.map((rel) => ({
			target_user_id: rel.targetUserId.toString(),
			type: rel.type,
			nickname: rel.nickname,
			since: rel.since?.toISOString() ?? null,
		})),
		notes: Array.from(userNotes.entries()).map(([targetUserId, note]) => ({
			target_user_id: targetUserId.toString(),
			note,
		})),
	};
	let archivedSettings: ArchivedUserSettings | null = null;
	if (userSettings) {
		const statusFields = {
			locale: userSettings.locale,
			theme: userSettings.theme,
			status: userSettings.status,
		};
		let customStatus: ArchivedUserSettings['custom_status'] = null;
		if (userSettings.customStatus) {
			customStatus = {
				text: userSettings.customStatus.text,
				emoji_id: userSettings.customStatus.emojiId?.toString() ?? null,
				emoji_name: userSettings.customStatus.emojiName,
				emoji_animated: userSettings.customStatus.emojiAnimated,
				expires_at: userSettings.customStatus.expiresAt?.toISOString() ?? null,
			};
		}
		archivedSettings = {
			...statusFields,
			custom_status: customStatus,
			developer_mode: userSettings.developerMode,
			message_display_compact: userSettings.compactMessageDisplay,
			animate_emoji: userSettings.animateEmoji,
			animate_stickers: userSettings.animateStickers,
			gif_auto_play: userSettings.gifAutoPlay,
			render_embeds: userSettings.renderEmbeds,
			render_reactions: userSettings.renderReactions,
			render_spoilers: userSettings.renderSpoilers,
			inline_attachment_media: userSettings.inlineAttachmentMedia,
			inline_embed_media: userSettings.inlineEmbedMedia,
			explicit_content_filter: userSettings.explicitContentFilter,
			friend_source_flags: userSettings.friendSourceFlags,
			default_guilds_restricted: userSettings.defaultGuildsRestricted,
			bot_default_guilds_restricted: userSettings.botDefaultGuildsRestricted,
			restricted_guilds: Array.from(userSettings.restrictedGuilds).map((id) => id.toString()),
			bot_restricted_guilds: Array.from(userSettings.botRestrictedGuilds).map((id) => id.toString()),
			guild_positions: userSettings.guildPositions.map((id) => id.toString()),
			guild_folders: userSettings.guildFolders.map((folder) => ({
				id: folder.folderId,
				name: folder.name,
				color: folder.color,
				flags: folder.flags,
				icon: folder.icon,
				guild_ids: folder.guildIds.map(String),
			})),
			afk_timeout: userSettings.afkTimeout,
			time_format: userSettings.timeFormat,
			suppress_unprivileged_self_mentions: userSettings.suppressUnprivilegedSelfMentions,
			suppress_unprivileged_self_mentions_bypass_user_ids: Array.from(
				userSettings.suppressUnprivilegedSelfMentionBypassUserIds,
			).map((id) => id.toString()),
			staff_dm_access_user_ids: Array.from(userSettings.staffDmAccessUserIds).map((id) => id.toString()),
			synced_preferences: syncedPreferencesToJson(decodeSyncedPreferencesLenient(userSettings.syncedPreferences)),
			profile_privacy: userSettings.profilePrivacy,
			privacy_setup_version: userSettings.privacySetupVersion,
			privacy_setup_completed_at: userSettings.privacySetupCompletedAt?.toISOString() ?? null,
		};
	}
	return {
		...responseFields,
		user_settings: archivedSettings,
		guild_memberships: guildMemberships
			.filter((membership): membership is GuildMembershipEntry & {member: GuildMember} => membership.member !== null)
			.map(({member, guild, guildId}) => ({
				guild_id: guildId.toString(),
				guild_name: guild?.name ?? null,
				joined_at: member.joinedAt.toISOString(),
				nick: member.nickname,
				avatar_hash: member.avatarHash,
				avatar_url: member.avatarHash
					? `${Config.endpoints.media}/guilds/${guildId}/users/${userId}/avatars/${member.avatarHash}`
					: null,
				banner_hash: member.bannerHash,
				banner_url: member.bannerHash
					? `${Config.endpoints.media}/guilds/${guildId}/users/${userId}/banners/${member.bannerHash}`
					: null,
				role_ids: Array.from(member.roleIds).map((id) => id.toString()),
			})),
		user_guild_settings: guildSettings
			.filter((settings) => settings !== null)
			.map((settings) => ({
				guild_id: settings.guildId.toString(),
				message_notifications: settings.messageNotifications,
				muted: settings.muted,
				mobile_push: settings.mobilePush,
				suppress_everyone: settings.suppressEveryone,
				suppress_roles: settings.suppressRoles,
				hide_muted_channels: settings.hideMutedChannels,
			})),
		...(threadMemberships.length > 0
			? {
					thread_memberships: threadMemberships.map((member) => ({
						thread_id: member.threadId.toString(),
						guild_id: member.guildId.toString(),
						parent_id: member.parentId.toString(),
						join_timestamp: member.joinTimestamp.toISOString(),
						flags: member.flags,
						muted: member.muted,
					})),
				}
			: {}),
		saved_messages: savedMessages.map((msg) => ({
			channel_id: msg.channelId.toString(),
			message_id: msg.messageId.toString(),
			saved_at: msg.savedAt.toISOString(),
		})),
		private_channels: privateChannels.map((channel) => ({
			channel_id: channel.id.toString(),
			type: channel.type,
			name: channel.name,
			icon_hash: channel.iconHash,
			owner_id: channel.ownerId?.toString() ?? null,
			recipient_ids: Array.from(channel.recipientIds).map((id) => id.toString()),
			last_message_id: channel.lastMessageId?.toString() ?? null,
		})),
		favorite_memes: favoriteMemes.map((meme) => ({
			meme_id: meme.id.toString(),
			name: meme.name,
			alt_text: meme.altText,
			tags: meme.tags,
			filename: meme.filename,
			content_type: meme.contentType,
			size: meme.size.toString(),
			width: meme.width,
			height: meme.height,
			duration: meme.duration,
		})),
		push_subscriptions: pushSubscriptions.map((sub) => ({
			subscription_id: sub.subscriptionId,
			platform: sub.platform,
			app_id: sub.appId,
			provider_environment: sub.providerEnvironment,
			endpoint: sub.endpoint,
			user_agent: sub.userAgent,
		})),
		webauthn_credentials: webAuthnCredentials.map((cred) => ({
			credential_id: cred.credentialId,
			name: cred.name,
			transports: cred.transports ? Array.from(cred.transports) : [],
			created_at: cred.createdAt.toISOString(),
			last_used_at: cred.lastUsedAt?.toISOString() ?? null,
		})),
		mfa_backup_codes: {
			total_count: mfaBackupCodes.length,
			consumed_count: mfaBackupCodes.filter((code) => code.consumed).length,
			remaining_count: mfaBackupCodes.filter((code) => !code.consumed).length,
		},
		...(recoveryKitCreatedAt ? {recovery_kit: {created_at: recoveryKitCreatedAt.toISOString()}} : {}),
		oauth_applications: oauthClients.map(mapOAuthApplication),
		connections: connections.map((connection) => ({
			id: connection.connection_id,
			type: connection.connection_type,
			identifier: connection.identifier,
			name: connection.name,
			verified: connection.verified,
			visibility_flags: connection.visibility_flags,
			sort_order: connection.sort_order,
			created_at: connection.created_at.toISOString(),
			verified_at: connection.verified_at?.toISOString() ?? null,
			last_verified_at: connection.last_verified_at?.toISOString() ?? null,
		})),
		pinned_dms: pinnedDms.map((pin) => ({
			channel_id: pin.channel_id.toString(),
			sort_order: pin.sort_order,
		})),
		...mapSecurityData({authorizedIps, activityData}),
	};
}
