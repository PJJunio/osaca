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
});
