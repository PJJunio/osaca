// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {fetchUserSettings, updateUserSettings} from '@app/api/user/tests/UserTestUtils';
import {SensitiveMediaFilterLevel} from '@osaca/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

describe('User Settings - Sensitive Content Filters', () => {
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
	test('a new account gets the default filters', async () => {
		const account = await createTestAccount(harness);
		const {json} = await fetchUserSettings(harness, account.token);
		expect(json.sensitive_content_friend_dm_filter).toBe(SensitiveMediaFilterLevel.SHOW);
		expect(json.sensitive_content_non_friend_dm_filter).toBe(SensitiveMediaFilterLevel.BLOCK);
		expect(json.sensitive_content_guild_filter).toBe(SensitiveMediaFilterLevel.BLUR);
	});
	test('any account can relax or tighten every filter, since OSACA never collects a date of birth', async () => {
		const account = await createTestAccount(harness);
		const {json} = await updateUserSettings(harness, account.token, {
			sensitive_content_friend_dm_filter: SensitiveMediaFilterLevel.SHOW,
			sensitive_content_non_friend_dm_filter: SensitiveMediaFilterLevel.SHOW,
			sensitive_content_guild_filter: SensitiveMediaFilterLevel.SHOW,
		});
		expect(json.sensitive_content_friend_dm_filter).toBe(SensitiveMediaFilterLevel.SHOW);
		expect(json.sensitive_content_non_friend_dm_filter).toBe(SensitiveMediaFilterLevel.SHOW);
		expect(json.sensitive_content_guild_filter).toBe(SensitiveMediaFilterLevel.SHOW);
		const {json: tightened} = await updateUserSettings(harness, account.token, {
			sensitive_content_non_friend_dm_filter: SensitiveMediaFilterLevel.BLOCK,
		});
		expect(tightened.sensitive_content_non_friend_dm_filter).toBe(SensitiveMediaFilterLevel.BLOCK);
	});
});
