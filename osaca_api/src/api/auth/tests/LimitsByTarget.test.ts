// SPDX-License-Identifier: AGPL-3.0-or-later

// ADR-0017: limits follow what is attacked (an Account, an invite or registration URL code), never the address a
// request comes from.

import {recordSignUpThroughCodes, SIGN_UPS_PER_CODE_PER_HOUR} from '@app/api/auth/AccountBudgets';
import {loginFailureLimit} from '@app/api/auth/AuthLogin';
import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {UsernameFailureSteps} from '@app/api/auth/UsernameFailures';
import {Config} from '@app/api/Config';
import {getKVClient} from '@app/api/middleware/ServiceRegistry';
import {getInstanceConfigRepository, getRateLimitService} from '@app/api/middleware/ServiceSingletons';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {
	CAPTCHA_TEST_HEADER,
	type CaptchaErrorBody,
	CHEAP_CAPTCHA_COST,
	solveCaptchaChallenge,
	useCheapCaptcha,
} from '@app/api/test/CaptchaTestUtils';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const RATE_LIMITS_TEST_HEADER = 'x-osaca-test-enable-rate-limits';

describe('Limits by target (ADR-0017)', () => {
	let harness: ApiTestHarness;
	const originalRelax = Config.dev.relaxRegistrationRateLimits;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
		await useCheapCaptcha();
	});
	afterEach(() => {
		Config.dev.relaxRegistrationRateLimits = originalRelax;
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	async function fillLoginFailures(login: string, count: number): Promise<void> {
		const limit = loginFailureLimit(login)!;
		for (let failure = 0; failure < count; failure++) await getRateLimitService().checkLimit(limit);
	}

	async function loginChallenge(login: string, ip: string): Promise<CaptchaErrorBody> {
		const {json} = await createBuilderWithoutAuth<CaptchaErrorBody>(harness)
			.post('/auth/login')
			.header('x-forwarded-for', ip)
			.header(CAPTCHA_TEST_HEADER, 'true')
			.body({login, password: 'not-the-password'})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CAPTCHA_REQUIRED)
			.executeWithResponse();
		return json;
	}

	const costOf = (body: CaptchaErrorBody) => (body.altcha_challenge!.parameters as {cost: number}).cost;

	describe('sign-in failures', () => {
		it('raise the captcha cost for that Account only, whatever address they came from', async () => {
			for (let failure = 0; failure < UsernameFailureSteps.login.failuresPerStep; failure++) {
				await createBuilderWithoutAuth(harness)
					.post('/auth/login')
					.header('x-forwarded-for', `192.0.2.${failure + 1}`)
					.body({login: 'target_account', password: 'not-the-password'})
					.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
					.execute();
			}
			expect(costOf(await loginChallenge('target_account', '198.51.100.7'))).toBe(CHEAP_CAPTCHA_COST * 2);
			expect(costOf(await loginChallenge('Target_Account', '198.51.100.8'))).toBe(CHEAP_CAPTCHA_COST * 2);
			expect(costOf(await loginChallenge('someone_else', '198.51.100.7'))).toBe(CHEAP_CAPTCHA_COST);
		});

		it('never lock the owner out while the captcha is on', async () => {
			const account = await createTestAccount(harness);
			await fillLoginFailures(account.username, 100);
			const required = await loginChallenge(account.username, '198.51.100.7');
			await createBuilderWithoutAuth(harness)
				.post('/auth/login')
				.header('x-forwarded-for', '198.51.100.7')
				.header(CAPTCHA_TEST_HEADER, 'true')
				.header(RATE_LIMITS_TEST_HEADER, 'true')
				.header('x-captcha-token', await solveCaptchaChallenge(required))
				.body({login: account.username, password: account.password})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		it('lock the Account after 100 failures in an hour while the captcha is off', async () => {
			const account = await createTestAccount(harness);
			await fillLoginFailures(account.username, 100);
			await createBuilderWithoutAuth(harness)
				.post('/auth/login')
				.header('x-forwarded-for', '198.51.100.9')
				.header(RATE_LIMITS_TEST_HEADER, 'true')
				.body({login: account.username, password: account.password})
				.expect(429)
				.execute();
		});
	});

	describe('wrong recovery keys', () => {
		it('raise the captcha cost of recovering that username only', async () => {
			const recover = (login: string) =>
				createBuilderWithoutAuth<CaptchaErrorBody>(harness)
					.post('/auth/recover')
					.body({login, recovery_key: 'AAAA-BBBB-CCCC-DDDD', password: 'recover-target-password-1'});
			for (let failure = 0; failure < UsernameFailureSteps.recover.failuresPerStep; failure++) {
				await recover('recover_target').expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY').execute();
			}
			const challengeCost = async (login: string) =>
				costOf(
					(
						await recover(login)
							.header(CAPTCHA_TEST_HEADER, 'true')
							.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CAPTCHA_REQUIRED)
							.executeWithResponse()
					).json,
				);
			expect(await challengeCost('recover_target')).toBe(CHEAP_CAPTCHA_COST * 2);
			expect(await challengeCost('someone_else')).toBe(CHEAP_CAPTCHA_COST);
		});
	});

	describe('sign-ups through a code', () => {
		async function createRegistrationUrlCode(): Promise<string> {
			const {code} = await getInstanceConfigRepository().createRegistrationUrl({
				label: null,
				createdByUserId: '1',
				expiresAt: null,
				maxUses: null,
				approvalRequired: false,
			});
			return code;
		}

		it(`stop at ${SIGN_UPS_PER_CODE_PER_HOUR} an hour per code, from any address`, async () => {
			Config.dev.relaxRegistrationRateLimits = false;
			const busy = await createRegistrationUrlCode();
			const quiet = await createRegistrationUrlCode();
			const env = {kv: getKVClient(), rateLimit: getRateLimitService(), enforce: true};
			for (let signUp = 0; signUp < SIGN_UPS_PER_CODE_PER_HOUR; signUp++) {
				await recordSignUpThroughCodes(env, {registrationUrlCode: busy, inviteCode: null});
			}
			const register = (code: string, ip: string) =>
				createBuilderWithoutAuth(harness)
					.post('/auth/register')
					.header('x-forwarded-for', ip)
					.body({global_name: 'Newcomer', consent: true, registration_url_code: code});
			await register(busy, '203.0.113.50').expect(429).execute();
			await register(quiet, '203.0.113.51').expect(HTTP_STATUS.OK).execute();
		});
	});

	it('counts each invite code of a list on its own', async () => {
		Config.dev.relaxRegistrationRateLimits = false;
		const env = {kv: getKVClient(), rateLimit: getRateLimitService(), enforce: true};
		for (let signUp = 0; signUp < SIGN_UPS_PER_CODE_PER_HOUR; signUp++) {
			await recordSignUpThroughCodes(env, {registrationUrlCode: null, inviteCode: 'busyinvite'});
		}
		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.header('x-forwarded-for', '203.0.113.60')
			.body({global_name: 'Newcomer', consent: true, invite_code: 'otherinvite, busyinvite'})
			.expect(429)
			.execute();
	});

	describe('public invite reads', () => {
		it('share one budget per code among visitors without a session', async () => {
			const {limit} = RateLimitConfigs.INVITE_GET.anonymous!;
			const read = (code: string, ip: string) =>
				createBuilderWithoutAuth(harness)
					.get(`/invites/${code}`)
					.header('x-forwarded-for', ip)
					.header(RATE_LIMITS_TEST_HEADER, 'true');
			// A leaky bucket drains while the loop runs, so a few more reads than the limit may pass.
			let refusedAt: number | null = null;
			for (let request = 0; request < limit + 20 && refusedAt === null; request++) {
				const response = await read('busycode', `192.0.2.${(request % 8) + 1}`).executeRaw();
				if (response.response.status === 429) refusedAt = request;
				else expect(response.response.status).toBe(HTTP_STATUS.NOT_FOUND);
			}
			expect(refusedAt).not.toBeNull();
			expect(refusedAt!).toBeGreaterThanOrEqual(limit);
			await read('quietcode', '198.51.100.99').expect(HTTP_STATUS.NOT_FOUND).execute();
		});
	});
});
