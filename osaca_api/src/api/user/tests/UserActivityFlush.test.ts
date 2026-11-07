// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {getUserActivityBuffer, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const REGISTRATION_IP = '198.51.100.7';
const REQUEST_IP = '203.0.113.7';

async function fetchMeFromIp(harness: ApiTestHarness, token: string, ip: string): Promise<void> {
	await createBuilder(harness, token).get('/users/@me').header('x-forwarded-for', ip).expect(HTTP_STATUS.OK).execute();
}

describe('User activity buffering', () => {
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
	test('an authenticated request buffers last active timestamp without storing IP', async () => {
		const account = await createTestAccount(harness, {ipAddress: REGISTRATION_IP});
		const userId = createUserID(BigInt(account.userId));
		await fetchMeFromIp(harness, account.token, REQUEST_IP);
		const pending = await harness.kvProvider.hgetall('user_activity:pending');
		expect(pending[account.userId]).toBeDefined();
		const beforeFlush = await getUserRepository().getActivityTracking(userId);
		expect(beforeFlush?.last_active_ip).toBeNull();
		await getUserActivityBuffer().drainAndFlush();
		const afterFlush = await getUserRepository().getActivityTracking(userId);
		expect(afterFlush?.last_active_at).toBeInstanceOf(Date);
		expect(afterFlush?.last_active_ip).toBeNull();
	});
	test('never indexes users by last active IP', async () => {
		const account = await createTestAccount(harness, {ipAddress: REGISTRATION_IP});
		const userRepository = getUserRepository();
		const seeded = await userRepository.listUserIdsByLastActiveIp(REGISTRATION_IP, 10, 0);
		expect(seeded.userIds).toEqual([]);
		await fetchMeFromIp(harness, account.token, REQUEST_IP);
		await getUserActivityBuffer().drainAndFlush();
		const current = await userRepository.listUserIdsByLastActiveIp(REQUEST_IP, 10, 0);
		expect(current.userIds).toEqual([]);
	});
});
