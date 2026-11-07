// SPDX-License-Identifier: AGPL-3.0-or-later

import {z} from 'zod';

export const MlsKeyPackagesPublishRequest = z.object({
	device_id: z.string().min(1).describe('Device identifier for the key packages'),
	key_packages: z.array(z.string().min(1)).min(1).describe('Base64-encoded KeyPackage blobs'),
});
export type MlsKeyPackagesPublishRequest = z.infer<typeof MlsKeyPackagesPublishRequest>;

export const MlsKeyPackagesPublishResponse = z.object({
	published: z.number().int().nonnegative().describe('Number of newly published key packages'),
});
export type MlsKeyPackagesPublishResponse = z.infer<typeof MlsKeyPackagesPublishResponse>;

export const MlsClaimKeyPackageResponse = z.object({
	key_package: z.string().describe('Base64-encoded claimed KeyPackage blob'),
});
export type MlsClaimKeyPackageResponse = z.infer<typeof MlsClaimKeyPackageResponse>;

export const MlsCreateGroupRequest = z.object({
	group_id: z.string().min(1).describe('Unique group or channel identifier for the MLS group'),
	disappearing_ttl_seconds: z
		.number()
		.int()
		.positive()
		.nullable()
		.optional()
		.describe('Optional TTL in seconds for disappearing messages'),
});
export type MlsCreateGroupRequest = z.infer<typeof MlsCreateGroupRequest>;

export const MlsGroupResponse = z.object({
	group_id: z.string().describe('MLS group identifier'),
	current_epoch: z.number().int().nonnegative().describe('Current monotonic MLS epoch'),
	disappearing_ttl_seconds: z
		.number()
		.int()
		.nullable()
		.describe('Disappearing message TTL in seconds, or null if permanent'),
});
export type MlsGroupResponse = z.infer<typeof MlsGroupResponse>;

export const MlsCommitRequest = z.object({
	epoch: z.number().int().nonnegative().describe('Target epoch for the commit (must equal current_epoch + 1)'),
	commit: z.string().min(1).describe('Base64-encoded MLS Commit message blob'),
	welcome: z
		.string()
		.nullable()
		.optional()
		.describe('Optional base64-encoded MLS Welcome message blob for newly joined members'),
});
export type MlsCommitRequest = z.infer<typeof MlsCommitRequest>;

export const MlsCommitResponse = z.object({
	epoch: z.number().int().nonnegative().describe('New epoch after applying the commit'),
});
export type MlsCommitResponse = z.infer<typeof MlsCommitResponse>;

export const MlsCommitDetailResponse = z.object({
	group_id: z.string().describe('MLS group identifier'),
	epoch: z.number().int().nonnegative().describe('MLS epoch of the commit'),
	commit: z.string().describe('Base64-encoded MLS Commit message blob'),
});
export type MlsCommitDetailResponse = z.infer<typeof MlsCommitDetailResponse>;

export const MlsWelcomeDetailResponse = z.object({
	group_id: z.string().describe('MLS group identifier'),
	epoch: z.number().int().nonnegative().describe('MLS epoch of the welcome'),
	welcome: z.string().describe('Base64-encoded MLS Welcome message blob'),
});
export type MlsWelcomeDetailResponse = z.infer<typeof MlsWelcomeDetailResponse>;

export const MlsCiphertextMessageRequest = z.object({
	epoch: z.number().int().nonnegative().describe('MLS epoch under which this message is encrypted'),
	message_id: z.string().min(1).describe('Unique message identifier'),
	ciphertext: z.string().min(1).describe('Base64-encoded opaque ciphertext blob'),
});
export type MlsCiphertextMessageRequest = z.infer<typeof MlsCiphertextMessageRequest>;

export const MlsCiphertextMessageResponse = z.object({
	group_id: z.string().describe('MLS group identifier'),
	epoch: z.number().int().nonnegative().describe('MLS epoch of the ciphertext'),
	message_id: z.string().describe('Message identifier'),
	ciphertext: z.string().describe('Base64-encoded opaque ciphertext blob'),
	created_at: z.string().describe('ISO 8601 creation timestamp'),
	expires_at: z.string().nullable().describe('ISO 8601 expiration timestamp, or null if permanent'),
});
export type MlsCiphertextMessageResponse = z.infer<typeof MlsCiphertextMessageResponse>;

export const MlsCiphertextHistoryQuery = z.object({
	member_join_epoch: z.coerce
		.number()
		.int()
		.nonnegative()
		.optional()
		.default(0)
		.describe('Only fetch messages from this epoch onwards (ADR-0012 v1 rule)'),
	before: z.string().optional().describe('Message ID cursor to fetch history before'),
	limit: z.coerce
		.number()
		.int()
		.positive()
		.max(100)
		.optional()
		.default(50)
		.describe('Maximum number of messages to return (default 50, max 100)'),
});
export type MlsCiphertextHistoryQuery = z.infer<typeof MlsCiphertextHistoryQuery>;

export const MlsCiphertextHistoryResponse = z.object({
	messages: z.array(MlsCiphertextMessageResponse).describe('List of ciphertext messages ordered newest first'),
});
export type MlsCiphertextHistoryResponse = z.infer<typeof MlsCiphertextHistoryResponse>;
