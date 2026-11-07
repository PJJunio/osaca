// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	createNamedStringLiteralUnion,
	createStringType,
	SnowflakeStringType,
	SnowflakeType,
	withOpenApiType,
} from '@osaca/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const MessageReportCategoryEnum = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['harassment', 'harassment', 'Content that harasses, bullies, or intimidates users'],
			['hate_speech', 'hate_speech', 'Content promoting hatred against protected groups'],
			['violent_content', 'violent_content', 'Content depicting or promoting violence'],
			['spam', 'spam', 'Unsolicited bulk messages or promotional content'],
			['nsfw_violation', 'nsfw_violation', 'Adult content posted outside age-restricted channels'],
			['illegal_activity', 'illegal_activity', 'Content promoting or facilitating illegal activities'],
			['doxxing', 'doxxing', 'Content revealing private personal information'],
			['self_harm', 'self_harm', 'Content promoting self-harm or suicide'],
			['child_safety', 'child_safety', 'Content that endangers minors or depicts child abuse'],
			['malicious_links', 'malicious_links', 'Links to malware, phishing, or other malicious sites'],
			['impersonation', 'impersonation', 'Content falsely claiming to be another person or entity'],
			['other', 'other', 'Other violations not covered by specific categories'],
		],
		'Category of the message report',
	),
	'MessageReportCategory',
);
const UserReportCategoryEnum = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['harassment', 'harassment', 'User engages in harassment, bullying, or intimidation'],
			['hate_speech', 'hate_speech', 'User promotes hatred against protected groups'],
			['spam_account', 'spam_account', 'Account used for spamming or bulk messaging'],
			['impersonation', 'impersonation', 'User falsely claims to be another person or entity'],
			['underage_user', 'underage_user', 'User appears to be under the minimum required age'],
			['inappropriate_profile', 'inappropriate_profile', 'Profile contains inappropriate or offensive content'],
			['other', 'other', 'Other violations not covered by specific categories'],
		],
		'Category of the user report',
	),
	'UserReportCategory',
);
const GuildReportCategoryEnum = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['harassment', 'harassment', 'Guild facilitates harassment, bullying, or intimidation'],
			['hate_speech', 'hate_speech', 'Guild promotes hatred against protected groups'],
			['extremist_community', 'extremist_community', 'Guild promotes extremist or terrorist ideologies'],
			['illegal_activity', 'illegal_activity', 'Guild promotes or facilitates illegal activities'],
			['child_safety', 'child_safety', 'Guild endangers minors or hosts child abuse content'],
			['raid_coordination', 'raid_coordination', 'Guild coordinates attacks on other communities'],
			['spam', 'spam', 'Guild used for spamming or bulk messaging'],
			['malware_distribution', 'malware_distribution', 'Guild distributes malware or malicious software'],
			['other', 'other', 'Other violations not covered by specific categories'],
		],
		'Category of the guild report',
	),
	'GuildReportCategory',
);
export const ReportResponse = z.object({
	report_id: SnowflakeStringType.describe('The unique identifier for this report'),
	status: z.string().describe('Current status of the report (pending, resolved)'),
	reported_at: z.string().describe('ISO 8601 timestamp when the report was submitted'),
});

export type ReportResponse = z.infer<typeof ReportResponse>;

export const OkResponse = z.object({
	ok: z.boolean().describe('Whether the operation was successful'),
});

export type OkResponse = z.infer<typeof OkResponse>;

export const ReportMessageRequest = z.object({
	channel_id: SnowflakeType.describe('ID of the accessible channel containing the reported message'),
	message_id: SnowflakeType.describe('ID of the accessible message being reported'),
	category: MessageReportCategoryEnum,
});

export type ReportMessageRequest = z.infer<typeof ReportMessageRequest>;

export const ReportUserRequest = z.object({
	user_id: SnowflakeType.describe('ID of the user being reported'),
	category: UserReportCategoryEnum,
	guild_id: z.optional(SnowflakeType).describe('ID of the guild where the violation occurred'),
});

export type ReportUserRequest = z.infer<typeof ReportUserRequest>;

export const ReportGuildRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild being reported'),
	category: GuildReportCategoryEnum,
	invite_code: z
		.optional(createStringType(1, 64))
		.describe('Invite code proving access to the guild (required when not a member of a non-discoverable guild)'),
});

export type ReportGuildRequest = z.infer<typeof ReportGuildRequest>;
