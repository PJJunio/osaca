// SPDX-License-Identifier: AGPL-3.0-or-later

// ADR-0009: sessions and handoffs keep no client address, location or country.

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const ADDRESS_FIELDS = ['ip', 'masked_ip', 'client_ip', 'location', 'city', 'region', 'country', 'client_country'];

function addressFieldsIn(record: Record<string, unknown> | null | undefined): Array<string> {
	return record ? ADDRESS_FIELDS.filter((field) => field in record) : [];
}

describe('Sessions without client addresses', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	it('lists sessions with no address, location or country', async () => {
		const account = await createTestAccount(harness);
		const sessions = await createBuilder<Array<Record<string, unknown> & {client_info?: Record<string, unknown>}>>(
			harness,
			account.token,
		)
			.get('/auth/sessions')
			.execute();
		expect(sessions.length).toBeGreaterThan(0);
		for (const session of sessions) {
			expect(addressFieldsIn(session)).toEqual([]);
			expect(addressFieldsIn(session.client_info)).toEqual([]);
		}
	});

	it('describes a pending desktop handoff with no location', async () => {
		const {code} = await createBuilderWithoutAuth<{code: string}>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();
		const info = await createBuilderWithoutAuth<{client_info: Record<string, unknown> | null}>(harness)
			.get(`/auth/handoff/${code}/info`)
			.execute();
		expect(addressFieldsIn(info.client_info)).toEqual([]);
	});
});
