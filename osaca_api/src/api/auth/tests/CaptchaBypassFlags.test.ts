// SPDX-License-Identifier: AGPL-3.0-or-later

import {createAuthHarness, createUniqueUsername, registerUser} from '@app/api/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {CAPTCHA_TEST_HEADER, useCheapCaptcha} from '@app/api/test/CaptchaTestUtils';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

async function registerAndFlag(
	harness: ApiTestHarness,
	flags: Array<string>,
): Promise<{username: string; password: string; userId: string}> {
	const username = createUniqueUsername('captchaflags');
	const password = 'a-strong-password';
	const reg = await registerUser(harness, {
		username,
		global_name: 'Captcha Flags User',
		password,
		consent: true,
	});
	if (flags.length > 0) {
		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${reg.user_id}/security-flags`)
			.body({set_flags: flags})
			.execute();
	}
	return {username, password, userId: reg.user_id};
}

describe('Auth Captcha Bypass Flags', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createAuthHarness();
	});
	beforeEach(async () => {
		await harness.reset();
		await useCheapCaptcha();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});
	it('still requires a captcha for accounts without the APP_STORE_REVIEWER flag', async () => {
		const account = await registerAndFlag(harness, []);
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.header(CAPTCHA_TEST_HEADER, 'true')
			.body({login: account.username, password: account.password})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CAPTCHA_REQUIRED)
			.execute();
	});
});
