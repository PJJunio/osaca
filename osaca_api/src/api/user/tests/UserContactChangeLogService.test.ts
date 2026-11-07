// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, test} from 'vitest';

describe('UserContactChangeLogService', () => {
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
	describe('username change operations', () => {
		test('username change without password requires sudo mode', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.patch('/users/@me')
				.body({username: 'newusername'})
				.expect(HTTP_STATUS.FORBIDDEN, 'SUDO_MODE_REQUIRED')
				.execute();
		});
	});
});
