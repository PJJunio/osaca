// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {fetchUserMe, updateUserProfile} from '@app/api/user/tests/UserTestUtils';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

async function runCaseUpdateTest(
	harness: ApiTestHarness,
	testFn: (params: {
		account: {
			userId: string;
			token: string;
			email: string;
			password: string;
		};
		initialUser: {
			username: string;
			discriminator: string;
		};
	}) => Promise<void>,
): Promise<void> {
	const account = await createTestAccount(harness);
	const {json: initialUser} = await fetchUserMe(harness, account.token);
	await testFn({
		account,
		initialUser: {
			username: initialUser.username,
			discriminator: initialUser.discriminator,
		},
	});
}

describe('User Username Case Update', () => {
	let harness: ApiTestHarness;
	beforeEach(async () => {
		harness = await createApiTestHarness();
	});
	afterEach(async () => {
		await harness?.shutdown();
	});
	test('a username change keeps an explicitly echoed discriminator', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			const newUsername = `preserve${initialUser.username.slice(0, Math.min(initialUser.username.length, 24))}`;
			const updated = await updateUserProfile(harness, account.token, {
				username: newUsername,
				discriminator: initialUser.discriminator,
				password: account.password,
			});
			expect(updated.json.username).toBe(newUsername);
			expect(updated.json.discriminator).toBe(initialUser.discriminator);
		});
	});
	test('a username change refuses a tag that is already taken', async () => {
		await runCaseUpdateTest(harness, async ({account, initialUser}) => {
			const otherAccount = await createTestAccount(harness);
			const {json: otherUser} = await fetchUserMe(harness, otherAccount.token);
			await createBuilder(harness, otherAccount.token)
				.patch(`/test/users/${otherAccount.userId}/discriminator`)
				.body({discriminator: initialUser.discriminator})
				.expect(HTTP_STATUS.OK)
				.execute();
			const {response, text} = await createBuilder(harness, account.token)
				.patch('/users/@me')
				.body({
					username: otherUser.username,
					discriminator: initialUser.discriminator,
					password: account.password,
				})
				.executeRaw();
			expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
			expect(text).toContain('TAG_ALREADY_TAKEN');
		});
	});
});
