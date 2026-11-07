// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, setUserACLs, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const NEW_PASSWORD = 'reset-by-the-admin-2026';

describe('admin password reset links', () => {
	let harness: ApiTestHarness;
	let admin: TestAccount;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		admin = await setUserACLs(harness, await createTestAccount(harness), [AdminACLs.WILDCARD]);
	});

	afterAll(async () => {
		await harness.shutdown();
	});

	it('issues a link that resets the password', async () => {
		const target = await createTestAccount(harness);
		const link = await createBuilder<{url: string}>(harness, admin.token)
			.post(`/admin/users/${target.userId}/password-reset-link`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const token = link.url.split('/reset#token=')[1]!;
		expect(
			(await createBuilderWithoutAuth<{valid: boolean}>(harness).get(`/auth/reset/${token}`).execute()).valid,
		).toBe(true);
		const reset = await createBuilderWithoutAuth<{user_id: string}>(harness)
			.post('/auth/reset')
			.body({token, password: NEW_PASSWORD})
			.execute();
		expect(reset.user_id).toBe(target.userId);
		const login = await createBuilderWithoutAuth<{user_id: string}>(harness)
			.post('/auth/login')
			.body({login: target.username, password: NEW_PASSWORD})
			.execute();
		expect(login.user_id).toBe(target.userId);
		expect(
			(await createBuilderWithoutAuth<{valid: boolean}>(harness).get(`/auth/reset/${token}`).execute()).valid,
		).toBe(false);
	});
});
