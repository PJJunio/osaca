// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {
	formatMlsApplicationPayload,
	type MlsChatMessagePayload,
	type MlsMessageDeletePayload,
	type MlsMessageEditPayload,
	type MlsReactionAddPayload,
	type MlsReactionRemovePayload,
	parseMlsApplicationPayload,
} from '../mls/MlsPayloadSchemas';
import {ContactIdentityRecordSchema} from '../mls/MlsSchemas';

describe('MlsPayloadSchemas', () => {
	it('parses and formats chat_message payloads', () => {
		const payload: MlsChatMessagePayload = {
			version: 1,
			type: 'chat_message',
			content: 'Hello world!',
			nonce: '123456',
		};
		const formatted = formatMlsApplicationPayload(payload);
		const parsed = parseMlsApplicationPayload(formatted);
		expect(parsed).toEqual(payload);
	});

	it('falls back to chat_message for legacy raw plaintext strings', () => {
		const raw = 'Simple unformatted string';
		const parsed = parseMlsApplicationPayload(raw);
		expect(parsed).toEqual({
			version: 1,
			type: 'chat_message',
			content: raw,
		});
	});

	it('parses and formats message_edit payloads', () => {
		const payload: MlsMessageEditPayload = {
			version: 1,
			type: 'message_edit',
			target_message_id: 'msg-999',
			content: 'Updated content here',
		};
		const formatted = formatMlsApplicationPayload(payload);
		const parsed = parseMlsApplicationPayload(formatted);
		expect(parsed).toEqual(payload);
	});

	it('parses and formats reaction_add and reaction_remove payloads', () => {
		const addPayload: MlsReactionAddPayload = {
			version: 1,
			type: 'reaction_add',
			target_message_id: 'msg-123',
			emoji: {id: null, name: '🎉'},
			user_id: 'usr-456',
		};
		const formattedAdd = formatMlsApplicationPayload(addPayload);
		expect(parseMlsApplicationPayload(formattedAdd)).toEqual(addPayload);

		const removePayload: MlsReactionRemovePayload = {
			version: 1,
			type: 'reaction_remove',
			target_message_id: 'msg-123',
			emoji: {id: '78910', name: 'custom_party', animated: true},
			user_id: 'usr-456',
		};
		const formattedRemove = formatMlsApplicationPayload(removePayload);
		expect(parseMlsApplicationPayload(formattedRemove)).toEqual(removePayload);
	});

	it('parses and formats message_delete tombstone payloads', () => {
		const deletePayload: MlsMessageDeletePayload = {
			version: 1,
			type: 'message_delete',
			target_message_id: 'msg-to-delete',
		};
		const formattedDelete = formatMlsApplicationPayload(deletePayload);
		const parsed = parseMlsApplicationPayload(formattedDelete);
		expect(parsed).toEqual(deletePayload);
	});

	it('parses and formats chat_message payloads with encrypted attachments and previews', () => {
		const payload: MlsChatMessagePayload = {
			version: 1,
			type: 'chat_message',
			content: 'Check this confidential document https://example.com',
			nonce: 'att-nonce-1',
			attachments: [
				{
					id: 'att-1',
					filename: 'secret_budget.pdf',
					content_type: 'application/pdf',
					size: 1024,
					ciphertext_size: 1052,
					sha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
					key: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=',
					nonce: 'MDEyMzQ1Njc4OTAx',
					upload_filename: 'upload-uuid-1',
					thumbhash: '3OcRJYB4d3h/iIeHeEh3eIeAiA==',
					encrypted_thumbnail: {
						ciphertext: 'dGh1bWJuYWlsY2lwaGVydGV4dA==',
						nonce: 'MDEyMzQ1Njc4OTAx',
						width: 128,
						height: 128,
						content_type: 'image/jpeg',
					},
				},
			],
			previews: [
				{
					url: 'https://example.com',
					title: 'Example Domain',
					description: 'Example domain illustration',
					site_name: 'Example',
					image: {
						url: 'https://example.com/logo.png',
						width: 200,
						height: 200,
					},
				},
			],
		};
		const formatted = formatMlsApplicationPayload(payload);
		const parsed = parseMlsApplicationPayload(formatted);
		expect(parsed).toEqual(payload);
	});

	it('validates ContactIdentityRecordSchema', () => {
		const record = {
			accountId: 'user-123',
			identityKeyHex: 'a'.repeat(64),
			firstSeenAt: 1700000000000,
			lastSeenAt: 1700000050000,
			verified: false,
			keyChanged: true,
			pendingKeyHex: 'b'.repeat(64),
			previousKeys: [
				{
					identityKeyHex: '9'.repeat(64),
					retiredAt: 1699999900000,
				},
			],
		};
		const parsed = ContactIdentityRecordSchema.safeParse(record);
		expect(parsed.success).toBe(true);
	});
});
