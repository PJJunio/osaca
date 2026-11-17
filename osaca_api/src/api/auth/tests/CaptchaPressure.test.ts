// SPDX-License-Identifier: AGPL-3.0-or-later

// ADR-0017: the captcha cost on routes without a session follows how busy the whole Instance is, never the
// address a request comes from.

import {CaptchaPressure, type CaptchaPressureAction, recordCaptchaSolve} from '@app/api/auth/CaptchaPressure';
import {getKVClient} from '@app/api/middleware/ServiceRegistry';
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
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

// Early in a minute, so the solves a test records stay in the current one-minute bucket.
const MINUTE_START = new Date('2026-11-17T12:00:05Z');

describe('Captcha cost under Instance-wide pressure', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
		await useCheapCaptcha();
		vi.useFakeTimers({toFake: ['Date'], shouldAdvanceTime: true});
		vi.setSystemTime(MINUTE_START);
	});
	afterEach(() => {
		vi.useRealTimers();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	async function challengeCost(path: string, body: Record<string, unknown>, ip: string): Promise<number> {
		const {json} = await createBuilderWithoutAuth<CaptchaErrorBody>(harness)
			.post(path)
			.header('x-forwarded-for', ip)
			.header(CAPTCHA_TEST_HEADER, 'true')
			.body(body)
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CAPTCHA_REQUIRED)
			.executeWithResponse();
		return (json.altcha_challenge!.parameters as {cost: number}).cost;
	}

	async function recordSolves(action: CaptchaPressureAction, count: number): Promise<void> {
		for (let solve = 0; solve < count; solve++) await recordCaptchaSolve(getKVClient(), action);
	}

	const loginBody = {login: 'pressure-nobody', password: 'not-a-real-password'};
	const recoverBody = {login: 'pressure-nobody', recovery_key: 'not-a-real-key', password: 'not-a-real-password-1'};
	const registerBody = {username: 'pressureuser', password: 'pressure-password-1', consent: true};

	it.each([
		['login', '/auth/login', loginBody],
		['recover', '/auth/recover', recoverBody],
		['register', '/auth/register', registerBody],
	] as const)('doubles the %s cost for every address once the Instance is busy', async (action, path, body) => {
		expect(await challengeCost(path, body, '192.0.2.10')).toBe(CHEAP_CAPTCHA_COST);
		await recordSolves(action, CaptchaPressure[action].solvesPerMinute);
		expect(await challengeCost(path, body, '192.0.2.10')).toBe(CHEAP_CAPTCHA_COST * 2);
		expect(await challengeCost(path, body, '198.51.100.20')).toBe(CHEAP_CAPTCHA_COST * 2);
	});

	it.each([
		['login', '/auth/login', loginBody, 'INVALID_FORM_BODY'],
		['register', '/auth/register', registerBody, null],
	] as const)('counts a solved %s challenge towards the pressure', async (action, path, body, refusal) => {
		await recordSolves(action, CaptchaPressure[action].solvesPerMinute - 1);
		const required = await createBuilderWithoutAuth<CaptchaErrorBody>(harness)
			.post(path)
			.header(CAPTCHA_TEST_HEADER, 'true')
			.body(body)
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CAPTCHA_REQUIRED)
			.executeWithResponse();
		const solved = createBuilderWithoutAuth(harness)
			.post(path)
			.header(CAPTCHA_TEST_HEADER, 'true')
			.header('x-captcha-token', await solveCaptchaChallenge(required.json))
			.body(body);
		await (refusal === null
			? solved.expect(HTTP_STATUS.OK)
			: solved.expect(HTTP_STATUS.BAD_REQUEST, refusal)
		).execute();
		expect(await challengeCost(path, body, '192.0.2.10')).toBe(CHEAP_CAPTCHA_COST * 2);
	});

	it('stops raising the cost at 64 times the base', async () => {
		await recordSolves('recover', CaptchaPressure.recover.solvesPerMinute * 10);
		expect(await challengeCost('/auth/recover', recoverBody, '192.0.2.10')).toBe(CHEAP_CAPTCHA_COST * 64);
	});

	it('lets the pressure fade over the next minute instead of dropping at the minute edge', async () => {
		await recordSolves('login', CaptchaPressure.login.solvesPerMinute * 2);
		vi.setSystemTime(new Date('2026-11-17T12:01:15Z'));
		expect(await challengeCost('/auth/login', loginBody, '192.0.2.10')).toBe(CHEAP_CAPTCHA_COST * 2);
		vi.setSystemTime(new Date('2026-11-17T12:02:15Z'));
		expect(await challengeCost('/auth/login', loginBody, '192.0.2.10')).toBe(CHEAP_CAPTCHA_COST);
	});

	it('keeps the instant account cost the same after an account from the same address', async () => {
		const instantBody = {global_name: 'Newcomer', consent: true};
		const ip = '192.0.2.44';
		const required = await createBuilderWithoutAuth<CaptchaErrorBody>(harness)
			.post('/auth/register')
			.header('x-forwarded-for', ip)
			.header(CAPTCHA_TEST_HEADER, 'true')
			.body(instantBody)
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.CAPTCHA_REQUIRED)
			.executeWithResponse();
		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.header('x-forwarded-for', ip)
			.header(CAPTCHA_TEST_HEADER, 'true')
			.header('x-captcha-token', await solveCaptchaChallenge(required.json))
			.body(instantBody)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(await challengeCost('/auth/register', instantBody, ip)).toBe(CHEAP_CAPTCHA_COST);
	});
});
