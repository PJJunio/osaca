// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {fetchOne, upsertOne} from '@app/api/database/CassandraQueryExecution';
import {Db} from '@app/api/database/CassandraTypes';
import type {UserRow} from '@app/api/database/types/UserTypes';
import {getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {Users} from '@app/api/Tables';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {backfillHiddenProfileBadges} from '@app/api/worker/tasks/BackfillHiddenProfileBadges';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import type {UserPrivateResponse} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const FETCH_USER_ROW = Users.select({where: Users.where.eq('user_id'), limit: 1});

const LEGACY_STAFF_HIDDEN = 1n << 57n;
const LEGACY_PREMIUM_BADGE_HIDDEN_IN_USER_FLAGS = 1n << 40n;

describe('hidden profile badges migration', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	afterAll(async () => {
		await harness.shutdown();
	});
	beforeEach(async () => {
		await harness.resetData();
	});

	async function writeLegacyFlags(account: TestAccount, flags: bigint): Promise<void> {
		await upsertOne(Users.patchByPk({user_id: createUserID(BigInt(account.userId))}, {flags: Db.set(flags)}));
	}

	async function storedRow(account: TestAccount): Promise<UserRow> {
		const row = await fetchOne<UserRow>(FETCH_USER_ROW.bind({user_id: createUserID(BigInt(account.userId))}));
		return row!;
	}

	async function hiddenList(account: TestAccount): Promise<Array<string>> {
		const me = await createBuilder<UserPrivateResponse>(harness, account.token)
			.get('/users/@me')
			.expect(HTTP_STATUS.OK)
			.execute();
		return me.hidden_profile_badges;
	}

	test('the legacy staff bit loads as a hidden key and the next write clears the bits', async () => {
		const staff = await createTestAccount(harness);
		await writeLegacyFlags(staff, UserFlags.STAFF | LEGACY_STAFF_HIDDEN | LEGACY_PREMIUM_BADGE_HIDDEN_IN_USER_FLAGS);
		expect(await hiddenList(staff)).toEqual(['staff']);

		await createBuilder(harness, staff.token)
			.patch('/users/@me')
			.body({bio: 'still hidden'})
			.expect(HTTP_STATUS.OK)
			.execute();
		const row = await storedRow(staff);
		expect(row.flags).toBe(UserFlags.STAFF);
		expect([...(row.hidden_profile_badges ?? [])]).toEqual(['staff']);
		expect(await hiddenList(staff)).toEqual(['staff']);
	});

	test('moving the bits on a write keeps flags changed by someone else after the read', async () => {
		const account = await createTestAccount(harness);
		await writeLegacyFlags(account, LEGACY_STAFF_HIDDEN);
		const userId = createUserID(BigInt(account.userId));
		const staleRow = (await getUserRepository().findUniqueAssert(userId)).toRow();
		await getUserRepository().updateFlags(userId, (flags) => flags | UserFlags.DISABLED);

		await getUserRepository().patchUpsert(userId, {bio: 'written from a stale read'}, staleRow);
		const row = await storedRow(account);
		expect(row.flags).toBe(UserFlags.DISABLED);
		expect([...(row.hidden_profile_badges ?? [])]).toEqual(['staff']);
	});

	test('the backfill moves every legacy bit once and leaves nothing for a second run', async () => {
		const staff = await createTestAccount(harness);
		const untouched = await createTestAccount(harness);
		await writeLegacyFlags(staff, UserFlags.STAFF | LEGACY_STAFF_HIDDEN);
		const untouchedVersion = (await storedRow(untouched)).version;

		expect(await backfillHiddenProfileBadges(getUserRepository(), 2)).toEqual({migrated: 1, failed: 0});
		const staffRow = await storedRow(staff);
		expect(staffRow.flags).toBe(UserFlags.STAFF);
		expect([...(staffRow.hidden_profile_badges ?? [])]).toEqual(['staff']);

		const version = (await storedRow(staff)).version;
		expect(await backfillHiddenProfileBadges(getUserRepository(), 2)).toEqual({migrated: 0, failed: 0});
		expect((await storedRow(staff)).version).toBe(version);
		expect((await storedRow(untouched)).version).toBe(untouchedVersion);
	});
});
