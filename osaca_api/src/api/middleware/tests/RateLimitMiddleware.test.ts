// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
import type {TrustedCallerConfig} from '@app/api/config/APIConfig';
import {
	ANONYMOUS_LIMIT_FACTOR,
	RateLimitMiddleware,
	type RouteRateLimitConfig,
} from '@app/api/middleware/RateLimitMiddleware';
import {OAuthRateLimitConfigs} from '@app/api/rate_limit_configs/OAuthRateLimitConfig';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import type {
	BucketConfig,
	IRateLimitService,
	RateLimitConfig,
	RateLimitResult,
} from '@pkgs/rate_limit/src/IRateLimitService';
import {Hono} from 'hono';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

function createAllowedResult(limit: number): RateLimitResult {
	return {
		allowed: true,
		limit,
		remaining: limit - 1,
		resetTime: new Date(Date.now() + 10000),
		resetAfterDecimal: 10,
	};
}

class RecordingRateLimitService implements IRateLimitService {
	readonly globalIdentifiers: Array<string> = [];
	readonly buckets: Array<string> = [];
	readonly limits: Array<number> = [];

	async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
		return createAllowedResult(config.maxAttempts);
	}

	async peekLimit(config: RateLimitConfig): Promise<RateLimitResult> {
		return createAllowedResult(config.maxAttempts);
	}

	async checkBucketLimit(bucket: string, config: BucketConfig): Promise<RateLimitResult> {
		this.buckets.push(bucket);
		this.limits.push(config.limit);
		return createAllowedResult(config.limit);
	}

	async checkGlobalLimit(identifier: string, limit: number): Promise<RateLimitResult> {
		this.globalIdentifiers.push(identifier);
		return createAllowedResult(limit);
	}

	async resetLimit(_identifier: string): Promise<void> {}

	async clearLimitsByIdentifierPrefix(_identifierPrefix: string): Promise<number> {
		return 0;
	}
}

interface Harness {
	app: Hono<HonoEnv>;
	service: RecordingRateLimitService;
}

const BUGS_KEY = 'bugs-key-0123456789abcdefghijklmnopqrstuv';

function buildHarness(routeConfig: RouteRateLimitConfig): Harness {
	const service = new RecordingRateLimitService();
	const app = new Hono<HonoEnv>({strict: true});
	app.use('*', async (ctx, next) => {
		ctx.set('rateLimitService', service);
		await next();
	});
	app.post('/route', RateLimitMiddleware(routeConfig), (ctx) => ctx.text('ok'));
	return {app, service};
}

async function callRoute(harness: Harness, headers: Record<string, string>): Promise<Response> {
	return await harness.app.request('http://localhost/route', {
		method: 'POST',
		headers: {'x-osaca-test-enable-rate-limits': 'true', ...headers},
	});
}

// ADR-0017: requests without a session are not told apart by address.
describe('RateLimitMiddleware without a session', () => {
	let previousTrustedCallers: Array<TrustedCallerConfig>;

	beforeEach(() => {
		previousTrustedCallers = Config.internal.trustedCallers;
		Config.internal.trustedCallers = [{name: 'bugs', key: BUGS_KEY, buckets: ['oauth:token']}];
	});

	afterEach(() => {
		Config.internal.trustedCallers = previousTrustedCallers;
	});

	test('puts every address, forwarded or not, in one shared bucket and skips the global limit', async () => {
		const harness = buildHarness(OAuthRateLimitConfigs.OAUTH_TOKEN);

		await callRoute(harness, {'x-forwarded-for': '192.0.2.50'});
		await callRoute(harness, {'x-forwarded-for': '198.51.100.7'});
		await callRoute(harness, {'x-osaca-internal-key': BUGS_KEY, 'x-osaca-client-ip': '203.0.113.77'});

		expect(harness.service.buckets).toEqual([
			'anonymous:oauth:token',
			'anonymous:oauth:token',
			'anonymous:oauth:token',
		]);
		expect(harness.service.globalIdentifiers).toEqual([]);
	});

	test(`allows ${ANONYMOUS_LIMIT_FACTOR} times the per-client limit, or the route's own shared limit`, async () => {
		const harness = buildHarness({bucket: 'plain', config: {limit: 5, windowMs: 1000}});
		await callRoute(harness, {});
		expect(harness.service.limits).toEqual([5 * ANONYMOUS_LIMIT_FACTOR]);

		const own = buildHarness({
			bucket: 'own',
			config: {limit: 5, windowMs: 1000},
			anonymous: {limit: 7, windowMs: 1000},
		});
		await callRoute(own, {});
		expect(own.service.limits).toEqual([7]);
	});
});
