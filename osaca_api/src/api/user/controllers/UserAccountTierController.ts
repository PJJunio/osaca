// SPDX-License-Identifier: AGPL-3.0-or-later

import {DefaultUserOnly, LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {claimAccount} from '@app/api/user/AccountClaim';
import {Validator} from '@app/api/Validator';
import {ClaimAccountRequest, ClaimAccountResponse} from '@osaca/schema/src/domains/user/AccountSchemas';

export function UserAccountTierController(app: HonoApp) {
	app.post(
		'/users/@me/claim',
		RateLimitMiddleware(RateLimitConfigs.USER_CLAIM),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', ClaimAccountRequest),
		OpenAPI({
			operationId: 'claim_account',
			summary: 'Claim an account created without credentials',
			responseSchema: ClaimAccountResponse,
			statusCode: 200,
			security: ['sessionToken'],
			tags: ['Users'],
			description:
				'Claims an account created without credentials by setting a password, so it can sign in from other devices.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			return ctx.json(
				await claimAccount(ctx.get('apiContext'), {
					user: ctx.get('user'),
					password: body.password,
				}),
			);
		},
	);
}
