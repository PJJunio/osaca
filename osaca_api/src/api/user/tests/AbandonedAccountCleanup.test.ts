// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, createUniqueUsername} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {getKVClient} from '@app/api/middleware/ServiceRegistry';
import {getInstanceConfigRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {CleanupModes} from '@osaca/constants/src/AccountConfigConstants';
import {DeletionReasons} from '@osaca/constants/src/Core';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Abandoned account cleanup', () => {
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

	async function registerWithToken(body: Record<string, unknown>): Promise<{user_id: string; token: string}> {
		return await createBuilderWithoutAuth<{user_id: string; token: string}>(harness)
			.post('/auth/register')
			.body({username: createUniqueUsername('wanderer'), consent: true, ...body})
			.execute();
	}

	async function register(body: Record<string, unknown>): Promise<string> {
		return (await registerWithToken(body)).user_id;
	}

	async function signOut(token: string): Promise<void> {
		await createBuilder(harness, token).post('/auth/logout').body(null).expect(204).execute();
	}

	async function idleFor(userId: string, days: number): Promise<void> {
		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${userId}/set-last-active-at`)
			.body({timestamp: new Date(Date.now() - days * DAY_MS).toISOString()})
			.execute();
	}

	async function sweep(): Promise<void> {
		await createBuilderWithoutAuth(harness).post('/test/worker/process-inactivity-deletions').body({}).execute();
	}

	async function deletionReason(userId: string): Promise<number | null> {
		const user = await getUserRepository().findUniqueAssert(createUserID(BigInt(userId)));
		return user.pendingDeletionAt ? user.deletionReasonCode : null;
	}

	it('leaves idle unclaimed accounts alone while the sweep is off', async () => {
		const userId = await register({});
		await idleFor(userId, 120);
		await sweep();
		expect(await deletionReason(userId)).toBeNull();
	});

	it('schedules idle accounts with no way back in once the sweep is on', async () => {
		await getInstanceConfigRepository().updateAccountsConfig({abandoned_account_cleanup: true});
		const unclaimed = await register({});
		const owner = await createTestAccount(harness);
		await idleFor(unclaimed, 120);
		await idleFor(owner.userId, 120);
		await sweep();
		expect(await deletionReason(unclaimed)).toBe(DeletionReasons.UNCLAIMED_ACCOUNT_ABANDONED);
		expect(await deletionReason(owner.userId)).toBeNull();
	});

	it('reads a missing activity entry as the last recorded activity, never as endless inactivity', async () => {
		await getInstanceConfigRepository().updateAccountsConfig({abandoned_account_cleanup: true});
		const fresh = await register({});
		const freshWithDate = await register({});
		const stale = await register({});
		await idleFor(stale, 120);
		await getKVClient().del(`user_activity:${fresh}`, `user_activity:${freshWithDate}`, `user_activity:${stale}`);
		await sweep();
		expect(await deletionReason(fresh)).toBeNull();
		expect(await deletionReason(freshWithDate)).toBeNull();
		expect(await deletionReason(stale)).toBe(DeletionReasons.UNCLAIMED_ACCOUNT_ABANDONED);
	});

	it('keeps an account with no way back in after its last session ends while the cleanup is off', async () => {
		const created = await registerWithToken({});
		await signOut(created.token);
		expect(await deletionReason(created.user_id)).toBeNull();
	});

	it('schedules an account with no way back in a day after its last session ends once the cleanup is on', async () => {
		await getInstanceConfigRepository().updateAccountsConfig({abandoned_account_cleanup: true});
		const created = await registerWithToken({});
		await signOut(created.token);
		const user = await getUserRepository().findUniqueAssert(createUserID(BigInt(created.user_id)));
		expect(user.deletionReasonCode).toBe(DeletionReasons.UNCLAIMED_ACCOUNT_ABANDONED);
		expect(user.pendingDeletionAt!.getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000);
	});

	it('leaves an account with a confirmed email alone when it signs out with the cleanup on', async () => {
		await getInstanceConfigRepository().updateAccountsConfig({abandoned_account_cleanup: true});
		const account = await createTestAccount(harness);
		await signOut(account.token);
		expect(await deletionReason(account.userId)).toBeNull();
	});

	it('honours the configured idle days of each cleanup policy', async () => {
		await getInstanceConfigRepository().updateAccountsConfig({
			unclaimed_account_cleanup: {mode: CleanupModes.AFTER_INACTIVITY, inactive_days: 30},
		});
		const unclaimed = await register({});
		const recent = await register({});
		await idleFor(unclaimed, 40);
		await idleFor(recent, 20);
		await sweep();
		expect(await deletionReason(unclaimed)).toBe(DeletionReasons.UNCLAIMED_ACCOUNT_ABANDONED);
		expect(await deletionReason(recent)).toBeNull();
	});

	it('leaves suspended accounts alone', async () => {
		await getInstanceConfigRepository().updateAccountsConfig({abandoned_account_cleanup: true});
		const suspended = await register({});
		const users = getUserRepository();
		const banned = await users.findUniqueAssert(createUserID(BigInt(suspended)));
		await users.patchUpsert(
			banned.id,
			{flags: banned.flags | UserFlags.DISABLED, temp_banned_until: new Date(Date.now() + 30 * DAY_MS)},
			banned.toRow(),
		);
		await idleFor(suspended, 120);
		await sweep();
		expect(await deletionReason(suspended)).toBeNull();
	});
});
