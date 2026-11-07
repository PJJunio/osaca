// SPDX-License-Identifier: AGPL-3.0-or-later

import {createCaptchaChallenge, EscalatingCaptchaMiddleware} from '@app/api/middleware/CaptchaMiddleware';
import {getTrustedForwardedClientIp, RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@app/api/types/HonoEnv';
import {tierContextFrom} from '@app/api/user/AccountTier';
import {isJsonRecord} from '@app/api/utils/JsonBoundaryUtils';
import {Validator} from '@app/api/Validator';
import {MissingAccessError} from '@osaca/errors/src/domains/core/MissingAccessError';
import {
	AccountHandoffRedeemRequest,
	AccountHandoffRequest,
	AccountHandoffResponse,
	AuthRegisterSuccessResponse,
	CaptchaChallengeResponse,
} from '@osaca/schema/src/domains/auth/AuthSchemas';
import type {Context} from 'hono';

function requireTrustedClientIp(ctx: Context<HonoEnv>, bucket: string): string {
	const clientIp = getTrustedForwardedClientIp(ctx, bucket);
	if (!clientIp) throw new MissingAccessError();
	return clientIp;
}

async function handoffCaptchaSteps(ctx: Context<HonoEnv>): Promise<number> {
	const clientIp = requireTrustedClientIp(ctx, RateLimitConfigs.AUTH_REGISTER_HANDOFF.bucket);
	const body: unknown = await ctx.req.json();
	const code = isJsonRecord(body) && typeof body.registration_url_code === 'string' ? body.registration_url_code : null;
	return await ctx.get('authRequestService').instantAccountChallengeSteps(ctx.req.raw, clientIp, code);
}

export function AccountEntryController(app: HonoApp) {
	app.get(
		'/auth/register/handoff/challenge',
		RateLimitMiddleware(RateLimitConfigs.AUTH_REGISTER_HANDOFF_CHALLENGE),
		OpenAPI({
			operationId: 'get_account_handoff_challenge',
			summary: 'Get the captcha challenge for creating an account from the website',
			responseSchema: CaptchaChallengeResponse,
			statusCode: 200,
			security: [],
			tags: ['Auth'],
			description:
				'Returns the captcha challenge that creating an instant account from the website needs right now for this visitor. Only the website server may call it.',
		}),
		async (ctx) => {
			const bucket = RateLimitConfigs.AUTH_REGISTER_HANDOFF_CHALLENGE.bucket;
			const clientIp = requireTrustedClientIp(ctx, bucket);
			const steps = await ctx.get('authRequestService').instantAccountChallengeSteps(ctx.req.raw, clientIp);
			ctx.header('Cache-Control', 'no-store');
			return ctx.json(await createCaptchaChallenge(ctx, steps));
		},
	);
	app.post(
		'/auth/register/handoff',
		RateLimitMiddleware(RateLimitConfigs.AUTH_REGISTER_HANDOFF),
		Validator('json', AccountHandoffRequest),
		EscalatingCaptchaMiddleware(handoffCaptchaSteps),
		OpenAPI({
			operationId: 'create_account_handoff',
			summary: 'Start an account from the website',
			responseSchema: AccountHandoffResponse,
			statusCode: 200,
			security: [],
			tags: ['Auth'],
			description:
				'Checks the display name and returns a single-use code that the web app redeems within 15 minutes. No account exists yet: the web app creates it on redeem, when the person submits the step whose notice says that creating the account accepts the terms of service. Only the website server may call it, and it passes the visitor IP. Requires a solved captcha challenge (X-Captcha-Token) whose cost grows with recent sign-ups. On a new self-hosted instance it fails with SETUP_TOKEN_REQUIRED until the first admin account exists.',
		}),
		async (ctx) => {
			const clientIp = requireTrustedClientIp(ctx, RateLimitConfigs.AUTH_REGISTER_HANDOFF.bucket);
			return ctx.json(
				await ctx.get('authRequestService').createAccountHandoff({data: ctx.req.valid('json'), clientIp}),
			);
		},
	);
	app.post(
		'/auth/register/handoff/redeem',
		RateLimitMiddleware(RateLimitConfigs.AUTH_ACCOUNT_HANDOFF_REDEEM),
		Validator('json', AccountHandoffRedeemRequest),
		OpenAPI({
			operationId: 'redeem_account_handoff',
			summary: 'Create the account started on the website',
			responseSchema: AuthRegisterSuccessResponse,
			statusCode: 200,
			security: [],
			tags: ['Auth'],
			description:
				'Redeems the code from create account handoff together with the nonce whose hash was sent then, creates the account with the agreement and display name given here (the display name sent with the handoff when none is given), and starts a session for the client that redeems it. The web app and the native apps can redeem it. Where the instance collects dates of birth, the account then sets one through the date of birth step. The code works once, and a wrong nonce also uses it up. A missing agreement or a display name that is not allowed answers before the code is used. It never ends or replaces another session.',
		}),
		async (ctx) => {
			return ctx.json(
				await ctx.get('authRequestService').redeemHandoff({
					data: ctx.req.valid('json'),
					request: ctx.req.raw,
					requestCache: ctx.get('requestCache'),
					tierContext: tierContextFrom(ctx),
				}),
			);
		},
	);
}
