// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface UserListResponse {
	users: Array<{
		id: string;
	}>;
	total: number;
}

const SYNTHETIC_USER_IDS = ['0', '1'];

describe('Admin user directory', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness({search: 'enabled'});
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});
	describe('GET /admin/acls', () => {
		test('requires an authenticated admin', async () => {
			const user = await createTestAccount(harness);
			await createBuilder(harness, `${user.token}`).get('/admin/acls').expect(HTTP_STATUS.FORBIDDEN).execute();
		});
	});
	describe('GET /admin/users', () => {
		test('resolves a user ID without a PII ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, [AdminACLs.AUTHENTICATE, AdminACLs.USER_LOOKUP]);
			const target = await createTestAccount(harness);
			const result = await createBuilder<UserListResponse>(harness, `${admin.token}`)
				.get(`/admin/users?resolve=${target.userId}`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(result.users.map((user) => user.id)).toEqual([target.userId]);
		});
		test.each(SYNTHETIC_USER_IDS)('omits the synthetic account %s from the resolve selector', async (userId) => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, [AdminACLs.AUTHENTICATE, AdminACLs.USER_LOOKUP]);
			const result = await createBuilder<UserListResponse>(harness, `${admin.token}`)
				.get(`/admin/users?resolve=${userId}`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(result.users).toEqual([]);
			expect(result.total).toBe(0);
		});
		test.each(SYNTHETIC_USER_IDS)('omits the synthetic account %s from the q selector', async (userId) => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, [AdminACLs.AUTHENTICATE, AdminACLs.USER_LOOKUP]);
			const result = await createBuilder<UserListResponse>(harness, `${admin.token}`)
				.get(`/admin/users?q=${userId}`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(result.users.map((user) => user.id)).not.toContain(userId);
		});
	});
});
