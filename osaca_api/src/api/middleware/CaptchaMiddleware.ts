// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHmac} from 'node:crypto';
import {Config} from '@app/api/Config';
import {Logger} from '@app/api/Logger';
import {getKVClient} from '@app/api/middleware/ServiceRegistry';
import type {User} from '@app/api/models/User';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {CaptchaProviders} from '@osaca/constants/src/CaptchaConstants';
import {Headers} from '@osaca/constants/src/Headers';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {CaptchaRequiredError, InvalidCaptchaError} from '@osaca/errors/src/CaptchaErrors';
import {type CaptchaConfig, isCaptchaActive} from '@osaca/schema/src/domains/admin/CaptchaSchemas';
import {AltchaProvider} from '@pkgs/captcha/src/providers/AltchaProvider';
import type {Context} from 'hono';
import {createMiddleware} from 'hono/factory';

const ALTCHA_SPENT_CHALLENGE_KEY_PREFIX = 'captcha:altcha:spent:';
const TEST_ENABLE_CAPTCHA_HEADER = 'x-osaca-test-enable-captcha';

function deriveAltchaSecret(label: string): string {
	return createHmac('sha256', Config.auth.sudoModeSecret).update(label).digest('hex');
}

function createAltchaProvider(config: CaptchaConfig): AltchaProvider {
	return new AltchaProvider({
		hmacSignatureSecret: deriveAltchaSecret('osaca-altcha-challenge-signature-v1'),
		hmacKeySignatureSecret: deriveAltchaSecret('osaca-altcha-key-signature-v1'),
		cost: config.cost,
		maxCounter: config.max_counter,
		claimChallenge: (signature, ttlSeconds) =>
			getKVClient().setnx(`${ALTCHA_SPENT_CHALLENGE_KEY_PREFIX}${signature}`, '1', ttlSeconds),
		logger: Logger,
	});
}

const MAX_CAPTCHA_ESCALATION_STEPS = 6;

async function altchaChallengeData(altcha: AltchaProvider, cost?: number): Promise<Record<string, unknown>> {
	return {captcha_provider: CaptchaProviders.ALTCHA, altcha_challenge: await altcha.createChallenge(cost)};
}

function isCaptchaBypassedForTest(ctx: Context<HonoEnv>): boolean {
	return Config.dev.testModeEnabled && ctx.req.header(TEST_ENABLE_CAPTCHA_HEADER) !== 'true';
}

function escalatedCaptchaCost(baseCost: number, steps: number): number {
	const boundedSteps = Math.min(Math.max(0, Math.floor(steps)), MAX_CAPTCHA_ESCALATION_STEPS);
	return baseCost * 2 ** boundedSteps;
}

export type CaptchaChallengeResponse =
	| {captcha_provider: typeof CaptchaProviders.NONE}
	| {
			captcha_provider: typeof CaptchaProviders.ALTCHA;
			altcha_challenge: Awaited<ReturnType<AltchaProvider['createChallenge']>>;
	  };

export async function createCaptchaChallenge(
	ctx: Context<HonoEnv>,
	escalationSteps = 0,
): Promise<CaptchaChallengeResponse> {
	if (isCaptchaBypassedForTest(ctx)) return {captcha_provider: CaptchaProviders.NONE};
	const config = await ctx.get('instanceConfigRepository').getCaptchaConfig();
	if (!isCaptchaActive(config)) return {captcha_provider: CaptchaProviders.NONE};
	return {
		captcha_provider: CaptchaProviders.ALTCHA,
		altcha_challenge: await createAltchaProvider(config).createChallenge(
			escalatedCaptchaCost(config.cost, escalationSteps),
		),
	};
}

export async function verifyCaptchaToken(ctx: Context<HonoEnv>, escalationSteps = 0): Promise<boolean> {
	if (isCaptchaBypassedForTest(ctx)) return false;
	const config = await ctx.get('instanceConfigRepository').getCaptchaConfig();
	if (!isCaptchaActive(config)) return false;
	const user = ctx.get('user') as User | undefined;
	if (userHasCaptchaExemptFlag(user)) return false;
	const altcha = createAltchaProvider(config);
	const cost = escalatedCaptchaCost(config.cost, escalationSteps);
	const token = ctx.req.header(Headers.X_CAPTCHA_TOKEN);
	if (!token) {
		throw new CaptchaRequiredError(await altchaChallengeData(altcha, cost));
	}
	if (!(await altcha.verify({token, minCost: cost}))) {
		throw new InvalidCaptchaError(await altchaChallengeData(altcha, cost));
	}
	return true;
}

function userHasCaptchaExemptFlag(user: User | null | undefined): boolean {
	return user != null && (user.flags & UserFlags.APP_STORE_REVIEWER) !== 0n;
}

export const CaptchaMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	ctx.set('captchaVerified', await verifyCaptchaToken(ctx));
	await next();
});

export function EscalatingCaptchaMiddleware(resolveSteps: (ctx: Context<HonoEnv>) => Promise<number>) {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		ctx.set('captchaVerified', await verifyCaptchaToken(ctx, await resolveSteps(ctx)));
		await next();
	});
}
