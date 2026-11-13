import {ActivityContextMiddleware} from '@app/api/infrastructure/activity/ActivityMeta';
import {TrustedClientIpHeaderMiddleware} from '@app/api/middleware/TrustedClientIpHeaderMiddleware';
import {NoopLogger} from '@app/api/test/mocks/NoopLogger';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {type ClientIpResolution, ClientIpResolutionMiddleware} from '@app/api/utils/RequestClientIp';
import {ForbiddenError} from '@osaca/errors/src/domains/core/ForbiddenError';
import {Hono} from 'hono';
import {describe, expect, it} from 'vitest';

interface Pipeline {
	request: (headers: Record<string, string>) => Promise<Response>;
	resolutions: Array<ClientIpResolution | undefined>;
	errors: Array<unknown>;
}

function createPipeline(clientIpHeaderName = 'x-forwarded-for'): Pipeline {
	const resolutions: Array<ClientIpResolution | undefined> = [];
	const errors: Array<unknown> = [];
	const app = new Hono<HonoEnv>();
	app.use(ClientIpResolutionMiddleware);
	app.use(async (ctx, next) => {
		resolutions.push(ctx.get('clientIpResolution'));
		await next();
	});
	app.use(
		TrustedClientIpHeaderMiddleware({
			enabled: true,
			logger: new NoopLogger(),
			trustClientIpHeader: true,
			clientIpHeaderName,
		}),
	);
	app.use(ActivityContextMiddleware);
	app.get('/v1/messages', (ctx) => {
		resolutions.push(ctx.get('clientIpResolution'));
		return ctx.text('ok');
	});
	app.onError((error) => {
		errors.push(error);
		return new Response('error', {status: 403});
	});
	return {
		request: async (headers) => app.request('http://localhost/v1/messages', {headers}),
		resolutions,
		errors,
	};
}

describe('client ip resolution across the request pipeline', () => {
	it('resolves once and shares that resolution with every later middleware', async () => {
		const pipeline = createPipeline();
		const response = await pipeline.request({'x-forwarded-for': '203.0.113.10, 10.0.0.1'});
		expect(response.status).toBe(200);
		expect(pipeline.resolutions).toHaveLength(2);
		expect(pipeline.resolutions[0]?.ip).toBe('203.0.113.10');
		expect(pipeline.resolutions[1]).toBe(pipeline.resolutions[0]);
	});
	it('rejects a malformed client ip header after the early resolution saw no address', async () => {
		const pipeline = createPipeline();
		const response = await pipeline.request({'x-forwarded-for': 'not-an-ip'});
		expect(response.status).toBe(403);
		expect(pipeline.resolutions[0]?.ip).toBe(null);
		expect(pipeline.errors[0]).toBeInstanceOf(ForbiddenError);
	});
	it('rejects x-forwarded-for with an empty first hop', async () => {
		const pipeline = createPipeline();
		const response = await pipeline.request({'x-forwarded-for': ', 10.0.0.1'});
		expect(response.status).toBe(403);
		expect(pipeline.errors[0]).toBeInstanceOf(ForbiddenError);
	});
	it('passes requests through when the client ip header holds only whitespace', async () => {
		const pipeline = createPipeline();
		const response = await pipeline.request({'x-forwarded-for': '   '});
		expect(response.status).toBe(200);
	});
	it('passes requests through when no client ip header is present', async () => {
		const pipeline = createPipeline();
		const response = await pipeline.request({});
		expect(response.status).toBe(200);
		expect(pipeline.resolutions[0]?.ip).toBe(null);
		expect(pipeline.resolutions[1]).toBe(pipeline.resolutions[0]);
	});
	it('rejects an invalid trusted header even when the configured header contains a valid address', async () => {
		const pipeline = createPipeline('x-real-ip');
		const response = await pipeline.request({'x-forwarded-for': '203.0.113.10', 'x-real-ip': 'not-an-ip'});
		expect(response.status).toBe(403);
		expect(pipeline.errors[0]).toBeInstanceOf(ForbiddenError);
	});
});
