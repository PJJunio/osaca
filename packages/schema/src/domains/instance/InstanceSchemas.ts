// SPDX-License-Identifier: AGPL-3.0-or-later

import {RegistrationModes} from '@osaca/constants/src/AccountConfigConstants';
import {
	BUILT_IN_GUILD_BADGE_KINDS,
	CUSTOM_BADGE_LOOKUP_IDS_MAX,
	CUSTOM_BADGE_PAGE_LIMIT_DEFAULT,
	CUSTOM_BADGE_PAGE_LIMIT_MAX,
	DISCOVERY_GUILD_BADGE_LIMIT,
} from '@osaca/constants/src/BadgeConstants';
import {
	CaptchaProviderSchema,
	GuildJoinGateSchema,
	InstantAccountAvailabilitySchema,
	InteractionTierModeSchema,
} from '@osaca/schema/src/domains/account/AccountTierSchemas';
import {CustomBadgeCursorType, CustomBadgePositionType} from '@osaca/schema/src/domains/admin/AdminBadgeSchemas';
import {DomainMigrationDiscoveryResponse} from '@osaca/schema/src/domains/admin/DomainMigrationSchemas';
import {createQueryIntegerType} from '@osaca/schema/src/primitives/QueryValidators';
import {
	createNamedStringLiteralUnion,
	createStringType,
	SnowflakeStringType,
} from '@osaca/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const LimitFilterResponse = z.object({
	traits: z.array(z.string()).optional().describe('Trait filters for this limit rule'),
	guildFeatures: z.array(z.string()).optional().describe('Guild feature filters for this limit rule'),
});

const LimitRuleResponse = z.object({
	id: z.string().describe('Unique identifier for this limit rule'),
	filters: LimitFilterResponse.optional().describe('Filters that determine when this rule applies'),
	overrides: z
		.record(z.string(), z.number())
		.describe('Map of limit keys to their override values (differences from defaults)'),
});

const LimitConfigResponse = z.object({
	version: z.literal(2).describe('Wire format version'),
	traitDefinitions: z.array(z.string()).describe('Available trait definitions (e.g., "supporter")'),
	rules: z.array(LimitRuleResponse).describe('Array of limit rules to evaluate'),
	defaultsHash: z.string().describe('Hash of the default limit values for cache invalidation'),
});

export const InstanceBrandingSchema = z
	.object({
		product_name: z.string().describe('Public product name shown by client applications'),
		icon_url: z.string().nullable().describe('Optional image URL for the full application icon'),
		symbol_url: z.string().nullable().describe('Optional image URL for the compact application symbol'),
		logo_url: z.string().nullable().describe('Optional image URL for the application logo'),
		wordmark_url: z.string().nullable().describe('Optional image URL for the application wordmark'),
		favicon_url: z.string().nullable().describe('Optional favicon URL for browser metadata'),
		favicon_dark_url: z
			.string()
			.nullable()
			.describe('Optional favicon URL a self-hosted instance shows when the browser uses a dark color scheme'),
		theme_color: z.string().nullable().describe('Optional browser theme color'),
		status_page_url: z.string().nullable().describe('Optional public status page URL'),
		status_page_instatus: z
			.boolean()
			.describe(
				'Whether the server detected that the status page is an Instatus page that clients can read current incidents from',
			),
		status_page_incident_history_url: z
			.string()
			.nullable()
			.describe('Optional public status page incident history URL'),
		sign_in_backdrop_url: z
			.string()
			.nullable()
			.describe('Optional image URL drawn behind the sign-in card on a self-hosted instance'),
		custom_css: z
			.string()
			.nullable()
			.describe(
				'Optional stylesheet a self-hosted instance applies to its web and desktop app, except on sign-in pages',
			),
		upload_limit_message: z
			.string()
			.nullable()
			.describe(
				'Optional Markdown a self-hosted instance shows when a file is over the upload limit, in place of the default note',
			),
		trusted_domains: z
			.array(z.string())
			.describe(
				'Extra domains a self-hosted instance trusts, so links to them open without a warning. Each entry is a hostname, or a hostname with a *. prefix that also covers its subdomains',
			),
	})
	.describe('Branding values safe to expose to clients');
export type InstanceBranding = z.infer<typeof InstanceBrandingSchema>;

export const InstanceSetupSchema = z
	.object({
		configured: z.boolean().describe('Whether the instance administrator has completed initial setup'),
		admin_url: z.string().nullable().describe('Admin panel URL to continue instance setup'),
		setup_token_required: z
			.boolean()
			.optional()
			.describe(
				'Present only while a self-hosted instance is unconfigured. True when registration needs the setup token',
			),
		admin_exists: z
			.boolean()
			.optional()
			.describe(
				'Present only while a self-hosted instance is unconfigured. True once the first administrator account exists',
			),
	})
	.describe('Initial setup state for self-hosted instances');
export type InstanceSetup = z.infer<typeof InstanceSetupSchema>;

const InstanceLegalSchema = z
	.object({
		terms_url: z.string().nullable().describe('Optional public terms of service URL for account registration'),
		privacy_url: z.string().nullable().describe('Optional public privacy policy URL for account registration'),
		guidelines_url: z
			.string()
			.nullable()
			.describe('Optional public community guidelines URL linked from reporting and enforcement notices'),
	})
	.describe('Optional legal and policy document URLs shown to users');

export const InstanceAppPublicSchema = z.object({
	branding: InstanceBrandingSchema,
	setup: InstanceSetupSchema,
	legal: InstanceLegalSchema,
});
export type InstanceAppPublic = z.infer<typeof InstanceAppPublicSchema>;

export const InstanceEndpointsSchema = z
	.object({
		api: z.string().describe('Base URL for authenticated API requests'),
		api_client: z.string().describe('Base URL for client API requests'),
		api_public: z.string().describe('Base URL for public API requests'),
		api_transport: z
			.string()
			.optional()
			.describe('Base URL that official desktop clients send API requests to instead of api_client'),
		gateway: z.string().describe('WebSocket URL for the gateway'),
		media: z.string().describe('Base URL for the media proxy'),
		upload_relay: z.string().optional().describe('Base URL for proxied attachment and preview uploads'),
		static_cdn: z.string().describe('Base URL for static assets (avatars, emojis, etc.)'),
		marketing: z.string().describe('Base URL for the marketing website'),
		docs: z.string().optional().describe('Base URL for the documentation website'),
		admin: z.string().describe('Base URL for the admin panel'),
		invite: z.string().describe('Base URL for invite links'),
		gift: z.string().describe('Base URL for gift links'),
		webapp: z.string().describe('Base URL for the web application'),
	})
	.describe('Endpoint URLs for various services');
export type InstanceEndpoints = z.infer<typeof InstanceEndpointsSchema>;

export const InstanceCaptchaSchema = z
	.object({
		provider: CaptchaProviderSchema.describe('Captcha provider (altcha or none)'),
	})
	.describe('Captcha configuration');
export type InstanceCaptcha = z.infer<typeof InstanceCaptchaSchema>;

export const InstanceFeaturesSchema = z
	.object({
		voice_enabled: z.boolean().describe('Whether voice/video calling is enabled'),
		self_hosted: z.boolean().describe('Whether this is a self-hosted instance'),
		presigned_attachment_uploads: z.boolean().describe('Whether clients can request presigned attachment upload URLs'),
		phone_verification_enabled: z.boolean().describe('Deprecated. Always false.'),
		discovery_enabled: z
			.boolean()
			.optional()
			.describe('Whether the Explore community directory is available. Missing means true'),
		desktop_modules_enabled: z.boolean().optional().describe('Whether desktop clients may load downloadable modules'),
		account_deletion_grace_period_hours: z
			.number()
			.int()
			.min(1)
			.max(8760)
			.optional()
			.describe('Hours between a deletion request and the permanent deletion of the account'),
		instant_accounts: z
			.boolean()
			.optional()
			.describe('Whether accounts can be created from just a display name. Missing means false'),
		instant_account_availability: InstantAccountAvailabilitySchema.optional().describe(
			'Whether accounts can be created from just a display name through public sign-up, and why not. Missing means instant_accounts decides',
		),
		interaction_tier: InteractionTierModeSchema.optional().describe(
			'Which limits apply to accounts that have not finished setting up. Missing means legacy',
		),
		guild_join_gate: GuildJoinGateSchema.optional().describe(
			'When joining a community needs a finished account while interaction_tier is enforced. Missing means always',
		),
	})
	.describe('Feature flags for this instance');
export type InstanceFeatures = z.infer<typeof InstanceFeaturesSchema>;

export const InstanceRegistrationModeSchema = createNamedStringLiteralUnion(
	[
		[RegistrationModes.OPEN, 'open', 'Anyone can register'],
		[RegistrationModes.APPROVAL, 'approval', 'Anyone can register, but admins must approve new accounts'],
		[RegistrationModes.CLOSED, 'closed', 'Public registration is closed'],
	],
	'Registration mode',
);

export const InstanceRegistrationSchema = z
	.object({
		mode: InstanceRegistrationModeSchema.describe('Public registration mode for this instance'),
		admin_registration_urls_enabled: z.boolean().describe('Whether admin-issued registration URLs are accepted'),
	})
	.describe('Registration policy for this instance');
export type InstanceRegistration = z.infer<typeof InstanceRegistrationSchema>;

export const InstanceCommunitySchema = z
	.object({
		single_community: z
			.boolean()
			.describe('Whether this instance runs as a single community that every user automatically joins'),
		single_community_guild_id: z
			.string()
			.nullable()
			.describe('The stock community guild ID when single-community mode is enabled'),
		direct_messages_disabled: z.boolean().describe('Whether direct messages are disabled instance-wide'),
		friends_disabled: z
			.boolean()
			.optional()
			.describe('Whether friend requests are disabled instance-wide. Missing means direct_messages_disabled decides'),
		personal_notes_enabled: z
			.boolean()
			.optional()
			.describe('Whether people can use personal notes. Missing means they can'),
		guild_create_access: z
			.boolean()
			.describe(
				'Whether every account can create communities. When false, only admins and accounts granted the feature_guild_create limit can',
			),
	})
	.describe('Community topology and direct-message policy for this instance');
export type InstanceCommunity = z.infer<typeof InstanceCommunitySchema>;

export const InstanceServicesSchema = z
	.object({
		youtube_enabled: z.boolean().describe('Whether YouTube link enrichment is enabled for this instance'),
		bluesky_enabled: z.boolean().describe('Whether Bluesky profile connections are enabled for this instance'),
	})
	.describe('Optional third-party service integrations enabled for this instance');
export type InstanceServices = z.infer<typeof InstanceServicesSchema>;

export const InstancePushDeliveryModeSchema = z.enum(['direct']);
export type InstancePushDeliveryMode = z.infer<typeof InstancePushDeliveryModeSchema>;

export const InstancePushSchema = z
	.object({
		public_vapid_key: z.string().nullable().describe('VAPID public key for web push notifications'),
		delivery_mode: InstancePushDeliveryModeSchema.optional().describe('How push notifications reach devices'),
		event_resolution_path: z
			.string()
			.optional()
			.describe('API path clients call to resolve the payload of a push event'),
	})
	.describe('Push notification configuration');
export type InstancePush = z.infer<typeof InstancePushSchema>;

export const InstanceNoticeSchema = z
	.object({
		id: z.string().describe('Changes whenever the notice text changes, so clients can remember a dismissal'),
		message: z.string().describe('Notice text written by the instance administrator'),
		url: z.string().nullable().describe('Optional link shown with the notice'),
		starts_at: z.iso.datetime().nullable().describe('When clients start showing the notice, or null for now'),
		ends_at: z.iso.datetime().nullable().describe('When clients stop showing the notice, or null for no end'),
	})
	.describe('Notice from the instance administrator shown to everyone, such as planned maintenance');
export type InstanceNotice = z.infer<typeof InstanceNoticeSchema>;

export const InstanceGuildBadgeSchema = z.object({
	id: SnowflakeStringType.describe('The ID of the badge, as listed in badge_ids of a community'),
	name: z.string().describe('The name of the badge'),
	description: z.string().nullable().describe('Text shown under the name when hovering over the badge, or null'),
	asset_url: z.string().describe('URL of the badge image, served as WebP by the media proxy'),
	href: z.string().nullable().describe('URL opened when the badge is clicked, or null'),
	position: CustomBadgePositionType.optional(),
});

export type InstanceGuildBadge = z.infer<typeof InstanceGuildBadgeSchema>;

export const InstanceBadgeSchema = InstanceGuildBadgeSchema.extend({position: CustomBadgePositionType});

export type InstanceBadge = z.infer<typeof InstanceBadgeSchema>;

const CustomBadgesVersionType = z
	.string()
	.max(64)
	.describe('Version of the badge catalog. It changes whenever a badge is created, edited, deleted or moved');

export const InstanceBadgesQuery = z.object({
	ids: z
		.string()
		.regex(new RegExp(`^[0-9]{1,20}(?:,[0-9]{1,20}){0,${CUSTOM_BADGE_LOOKUP_IDS_MAX - 1}}$`))
		.optional()
		.describe(
			`Up to ${CUSTOM_BADGE_LOOKUP_IDS_MAX} badge IDs separated by commas. Only these badges are returned. Cannot be sent with after`,
		),
	after: CustomBadgeCursorType.optional(),
	limit: createQueryIntegerType({
		defaultValue: CUSTOM_BADGE_PAGE_LIMIT_DEFAULT,
		minValue: 1,
		maxValue: CUSTOM_BADGE_PAGE_LIMIT_MAX,
	}).describe(`Most badges to return, from 1 to ${CUSTOM_BADGE_PAGE_LIMIT_MAX}. Not used with ids`),
	version: CustomBadgesVersionType.optional().describe(
		'The catalog version the client already holds. When it is the current version the response can be cached for a day',
	),
});

export type InstanceBadgesQuery = z.infer<typeof InstanceBadgesQuery>;

export const InstanceBadgesResponse = z.object({
	version: CustomBadgesVersionType,
	badges: z
		.array(InstanceGuildBadgeSchema.required({position: true}))
		.max(CUSTOM_BADGE_PAGE_LIMIT_MAX)
		.describe('Community badges in display order. IDs that are unknown or deleted are left out'),
	next: CustomBadgeCursorType.nullable().describe(
		'Pass this as after to get the next page, or null on the last page and for a lookup by ids',
	),
});

export type InstanceBadgesResponse = z.infer<typeof InstanceBadgesResponse>;

const BuiltInGuildBadgeImageType = z
	.string()
	.nullable()
	.describe('URL of the image this instance shows for the badge, or null to use the built-in artwork');

export const InstanceBuiltInGuildBadgeImagesSchema = z.object({
	verified: BuiltInGuildBadgeImageType,
	partnered: BuiltInGuildBadgeImageType,
	discoverable: BuiltInGuildBadgeImageType,
});

export type InstanceBuiltInGuildBadgeImages = z.infer<typeof InstanceBuiltInGuildBadgeImagesSchema>;

export const InstanceHiddenBuiltInGuildBadgesSchema = z
	.array(z.enum(BUILT_IN_GUILD_BADGE_KINDS))
	.max(BUILT_IN_GUILD_BADGE_KINDS.length)
	.describe(
		'Built-in community badges this instance does not show. The community keeps the feature, such as being listed in discovery',
	);

export type InstanceHiddenBuiltInGuildBadges = z.infer<typeof InstanceHiddenBuiltInGuildBadgesSchema>;

export const WellKnownOsacaResponse = z.object({
	codename: z.string().optional().describe('Protocol generation spoken by this instance'),
	api_code_version: z.number().int().describe('Version of the API server code'),
	endpoints: InstanceEndpointsSchema,
	captcha: InstanceCaptchaSchema,
	features: InstanceFeaturesSchema,
	registration: InstanceRegistrationSchema,
	community: InstanceCommunitySchema,
	services: InstanceServicesSchema,
	limits: LimitConfigResponse.describe('Limit configuration with rules and trait definitions'),
	push: InstancePushSchema,
	app_public: InstanceAppPublicSchema.describe('Public application configuration for client-side features'),
	notice: InstanceNoticeSchema.nullable()
		.optional()
		.describe('Notice from the instance administrator, or null when there is none'),
	domain_migration: DomainMigrationDiscoveryResponse.optional().describe(
		'Web domain migration switch and anonymous rollout, only acted on by official instance clients',
	),
	guild_badges: z
		.array(InstanceGuildBadgeSchema)
		.max(DISCOVERY_GUILD_BADGE_LIMIT)
		.optional()
		.describe(
			`The first ${DISCOVERY_GUILD_BADGE_LIMIT} custom badges that communities on this instance can show next to their name, in display order. GET /instance/badges serves every badge`,
		),
	guild_badges_partial: z
		.boolean()
		.optional()
		.describe('True when the instance has more community badges than guild_badges lists'),
	custom_badges_version: CustomBadgesVersionType.optional(),
	built_in_guild_badge_images: InstanceBuiltInGuildBadgeImagesSchema.optional().describe(
		'Images this instance shows in place of the built-in verified, partnered and discoverable community badges',
	),
	hidden_built_in_guild_badges: InstanceHiddenBuiltInGuildBadgesSchema.optional(),
	voice_origins: z
		.array(z.string())
		.max(1000)
		.optional()
		.describe(
			'Origins of every voice server endpoint, such as wss://voice.example.com, for content security policies. Voice servers that share a domain are listed once as a wildcard, such as wss://*.example.com',
		),
});

export type WellKnownOsacaResponse = z.infer<typeof WellKnownOsacaResponse>;

export const InstanceSetupTokenCheckRequest = z.object({
	setup_token: createStringType(1, 256).describe('Setup token of a new self-hosted instance'),
});

export type InstanceSetupTokenCheckRequest = z.infer<typeof InstanceSetupTokenCheckRequest>;
