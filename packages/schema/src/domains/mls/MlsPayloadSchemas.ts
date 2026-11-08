// SPDX-License-Identifier: AGPL-3.0-or-later

import {z} from 'zod';

export const MLS_PAYLOAD_VERSION = 1;

export const MlsChatMessagePayload = z.object({
	version: z.literal(1).default(1),
	type: z.literal('chat_message'),
	content: z.string().describe('Plaintext message content'),
	nonce: z.string().optional().describe('Client nonce for tracking optimistic sends'),
});
export type MlsChatMessagePayload = z.infer<typeof MlsChatMessagePayload>;

export const MlsMessageEditPayload = z.object({
	version: z.literal(1).default(1),
	type: z.literal('message_edit'),
	target_message_id: z.string().min(1).describe('ID of the target message to edit'),
	content: z.string().describe('Updated plaintext message content'),
});
export type MlsMessageEditPayload = z.infer<typeof MlsMessageEditPayload>;

export const MlsReactionEmojiSchema = z.object({
	id: z.string().nullable().optional().describe('Custom emoji snowflake ID, or null for unicode emoji'),
	name: z.string().min(1).describe('Unicode character or custom emoji name'),
	animated: z.boolean().optional().describe('Whether the custom emoji is animated'),
});
export type MlsReactionEmoji = z.infer<typeof MlsReactionEmojiSchema>;

export const MlsReactionAddPayload = z.object({
	version: z.literal(1).default(1),
	type: z.literal('reaction_add'),
	target_message_id: z.string().min(1).describe('Target message ID for the reaction'),
	emoji: MlsReactionEmojiSchema,
	user_id: z.string().min(1).describe('User ID who added the reaction'),
});
export type MlsReactionAddPayload = z.infer<typeof MlsReactionAddPayload>;

export const MlsReactionRemovePayload = z.object({
	version: z.literal(1).default(1),
	type: z.literal('reaction_remove'),
	target_message_id: z.string().min(1).describe('Target message ID for the reaction'),
	emoji: MlsReactionEmojiSchema,
	user_id: z.string().min(1).describe('User ID whose reaction is removed'),
});
export type MlsReactionRemovePayload = z.infer<typeof MlsReactionRemovePayload>;

export const MlsMessageDeletePayload = z.object({
	version: z.literal(1).default(1),
	type: z.literal('message_delete'),
	target_message_id: z.string().min(1).describe('Target message ID to delete (tombstone)'),
});
export type MlsMessageDeletePayload = z.infer<typeof MlsMessageDeletePayload>;

export const MlsApplicationPayload = z.discriminatedUnion('type', [
	MlsChatMessagePayload,
	MlsMessageEditPayload,
	MlsReactionAddPayload,
	MlsReactionRemovePayload,
	MlsMessageDeletePayload,
]);
export type MlsApplicationPayload = z.infer<typeof MlsApplicationPayload>;

export function parseMlsApplicationPayload(rawPlaintext: string): MlsApplicationPayload {
	try {
		const parsed = JSON.parse(rawPlaintext);
		const result = MlsApplicationPayload.safeParse(parsed);
		if (result.success) {
			return result.data;
		}
	} catch {}

	// Backward compatibility fallback: treat non-JSON string as chat_message
	return {
		version: 1,
		type: 'chat_message',
		content: rawPlaintext,
	};
}

export function formatMlsApplicationPayload(payload: MlsApplicationPayload): string {
	return JSON.stringify(payload);
}

export interface ExtractedClientMentions {
	mentions: Array<{
		id: string;
		username?: string;
		discriminator?: string;
		avatar?: string | null;
		global_name?: string | null;
		avatar_color?: string | null;
		flags?: number;
	}>;
	mention_roles: Array<string>;
	mention_everyone: boolean;
}

export function extractClientMentions(content: string): ExtractedClientMentions {
	const userMatches = content.matchAll(/<@!?(\d+)>/g);
	const userIds = Array.from(new Set(Array.from(userMatches, (m) => m[1])));
	const mentions = userIds.map((id) => ({
		id,
		username: '',
		discriminator: '0000',
		avatar: null,
		global_name: null,
		avatar_color: null,
		flags: 0,
	}));

	const roleMatches = content.matchAll(/<@&(\d+)>/g);
	const mention_roles = Array.from(new Set(Array.from(roleMatches, (m) => m[1])));

	const mention_everyone = /(?:^|\s)@(everyone|here)\b/.test(content);

	return {
		mentions,
		mention_roles,
		mention_everyone,
	};
}
