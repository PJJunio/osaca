// SPDX-License-Identifier: AGPL-3.0-or-later

// ADR-0017: no limit or check on routes without a session keys on the client address any more.

import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {Config} from '@app/api/Config';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {CAPTCHA_TEST_HEADER, useCheapCaptcha} from '@app/api/test/CaptchaTestUtils';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {afterAll, afterEach, beforeAll, beforeEach, describe, it} from 'vitest';

const RATE_LIMITS_TEST_HEADER = 'x-osaca-test-enable-rate-limits';
const ADDRESS = '192.0.2.77';

describe('Limits without client addresses (ADR-0017)', () => {
	let harness: ApiTestHarness;
	const originalRelax = Config.dev.relaxRegistrationRateLimits;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterEach(() => {
		Config.dev.relaxRegistrationRateLimits = originalRelax;
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	it('lets one address fail many sign-ins to different usernames', async () => {
		for (let attempt = 0; attempt < 12; attempt++) {
			await createBuilderWithoutAuth(harness)
				.post('/auth/login')
				.header('x-forwarded-for', ADDRESS)
				.header(RATE_LIMITS_TEST_HEADER, 'true')
				.body({login: `nobody_${attempt}`, password: 'not-the-password'})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.execute();
		}
	});

	it('lets one address create more than three accounts an hour', async () => {
		Config.dev.relaxRegistrationRateLimits = false;
		for (let signUp = 0; signUp < 4; signUp++) {
			await createBuilderWithoutAuth(harness)
				.post('/auth/register')
				.header('x-forwarded-for', ADDRESS)
				.body({username: `addressuser${signUp}`, password: 'address-limits-password-1', consent: true})
				.expect(HTTP_STATUS.OK)
				.execute();
		}
	});

	it('limits account recovery per username, whatever the address', async () => {
		const recover = (login: string, attempt: number) =>
			createBuilderWithoutAuth(harness)
				.post('/auth/recover')
				.header('x-forwarded-for', `198.51.100.${attempt + 1}`)
				.header(RATE_LIMITS_TEST_HEADER, 'true')
				.body({login, recovery_key: 'AAAA-BBBB-CCCC-DDDD', password: 'recover-limits-password-1'});
		for (let attempt = 0; attempt < 5; attempt++) {
			await recover('recover_target', attempt).expect(HTTP_STATUS.BAD_REQUEST).execute();
		}
		await recover('recover_target', 5).expect(429).execute();
		await recover('someone_else', 6).expect(HTTP_STATUS.BAD_REQUEST).execute();
	});

	it('no longer offers to forget authorized addresses', async () => {
		const account = await createTestAccount(harness);
		await createBuilder(harness, account.token)
			.delete('/users/@me/authorized-ips')
			.body({password: account.password})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('asks for a solved challenge before looking up a desktop handoff code', async () => {
		await useCheapCaptcha();
		await createBuilderWithoutAuth(harness)
			.get('/auth/handoff/ABCD-EFGH/info')
			.header(CAPTCHA_TEST_HEADER, 'true')
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CAPTCHA_REQUIRED)
			.execute();
	});
});
