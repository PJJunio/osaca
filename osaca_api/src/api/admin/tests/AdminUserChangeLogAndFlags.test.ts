// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {afterAll, afterEach, beforeAll, beforeEach, describe, test, vi} from 'vitest';

describe('Admin User Change Log and Flags', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});
	describe('GET /admin/users/{user_id}/change-log', () => {
		test('rejects an admin holding USER_LOOKUP but not USER_VIEW_CONTACT_LOG', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, [AdminACLs.AUTHENTICATE, AdminACLs.USER_LOOKUP]);
			const target = await createTestAccount(harness);
			await createBuilder(harness, `${admin.token}`)
				.get(`/admin/users/${target.userId}/change-log?limit=50`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});
	});
	describe('DELETE /admin/users/{user_id}/mfa', () => {
		test('requires USER_UPDATE_MFA ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, [AdminACLs.AUTHENTICATE, AdminACLs.USER_LOOKUP]);
			const target = await createTestAccount(harness);
			await createBuilder(harness, `${admin.token}`)
				.delete(`/admin/users/${target.userId}/mfa`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});
	});
});
