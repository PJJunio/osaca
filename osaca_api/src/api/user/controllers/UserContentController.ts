// SPDX-License-Identifier: AGPL-3.0-or-later

import {Readable} from 'node:stream';
import {StorageObjectRangeNotSatisfiableError} from '@app/api/infrastructure/IStorageService';
import {DefaultUserOnly, LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {Validator} from '@app/api/Validator';
import {HarvestIdParam} from '@osaca/schema/src/domains/common/CommonParamSchemas';
import {
	HarvestArchiveResponse,
	HarvestCreationResponseSchema,
	HarvestDownloadQuery,
	HarvestDownloadUrlResponse,
	HarvestStatusResponseSchema,
	HarvestStatusResponseSchemaNullable,
} from '@osaca/schema/src/domains/user/UserHarvestSchemas';
import {HarvestSelfDataRequest} from '@osaca/schema/src/domains/user/UserRequestSchemas';

export function UserContentController(app: HonoApp) {
	app.post(
		'/users/@me/harvest',
		RateLimitMiddleware(RateLimitConfigs.USER_DATA_HARVEST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'request_data_harvest',
			summary: 'Request data harvest',
			responseSchema: HarvestCreationResponseSchema,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Requests a data harvest of all user data and content. Initiates an asynchronous process to compile and prepare all data for download in a portable format. Returns harvest ID and status.',
		}),
		async (ctx) => {
			const result = await ctx.get('userContentRequestService').requestHarvest({userId: ctx.get('user').id});
			return ctx.json(result, 200);
		},
	);
	app.post(
		'/users/@me/harvest/filtered',
		RateLimitMiddleware(RateLimitConfigs.USER_DATA_HARVEST),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', HarvestSelfDataRequest),
		OpenAPI({
			operationId: 'request_filtered_data_harvest',
			summary: 'Request filtered data harvest',
			responseSchema: HarvestCreationResponseSchema,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Requests a data harvest with the same optional scope and date-range filters offered by the bulk-delete endpoint. Settings, memberships, and other non-message data are always included; the filter only constrains which messages end up in the archive. Returns harvest ID and status.',
		}),
		async (ctx) => {
			const filter = ctx.req.valid('json');
			const result = await ctx
				.get('userContentRequestService')
				.requestFilteredHarvest({userId: ctx.get('user').id, filter});
			return ctx.json(result, 200);
		},
	);
	app.get(
		'/users/@me/harvest/latest',
		RateLimitMiddleware(RateLimitConfigs.USER_HARVEST_LATEST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_latest_data_harvest',
			summary: 'Get latest data harvest',
			responseSchema: HarvestStatusResponseSchemaNullable,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves the status of the most recent data harvest request. Returns null if no harvest has been requested yet. Shows progress and estimated completion time.',
		}),
		async (ctx) => {
			const harvest = await ctx.get('userContentRequestService').getLatestHarvest({userId: ctx.get('user').id});
			return ctx.json(harvest, 200);
		},
	);
	app.get(
		'/users/@me/harvest/:harvestId',
		RateLimitMiddleware(RateLimitConfigs.USER_HARVEST_STATUS),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', HarvestIdParam),
		OpenAPI({
			operationId: 'get_data_harvest_status',
			summary: 'Get data harvest status',
			responseSchema: HarvestStatusResponseSchema,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves detailed status information for a specific data harvest. Shows progress, completion status, and other metadata about the harvest request.',
		}),
		async (ctx) => {
			const {harvestId} = ctx.req.valid('param');
			const harvest = await ctx.get('userContentRequestService').getHarvestStatus({
				userId: ctx.get('user').id,
				harvestId,
			});
			return ctx.json(harvest, 200);
		},
	);
	app.get(
		'/harvest-downloads/:harvestId',
		RateLimitMiddleware(RateLimitConfigs.USER_HARVEST_DOWNLOAD_FILE),
		Validator('param', HarvestIdParam),
		Validator('query', HarvestDownloadQuery, (result, ctx) =>
			result.success ? undefined : ctx.text('Not Found', 404),
		),
		OpenAPI({
			operationId: 'download_data_harvest_archive',
			summary: 'Download data harvest archive',
			responseSchema: HarvestArchiveResponse,
			responseContentType: 'application/zip',
			statusCode: [200, 206],
			security: [],
			tags: ['Users'],
			description:
				'Streams a completed data harvest archive. Authorised by a signed, expiring token rather than a session, so the link works outside the app. Only active when presigned harvest downloads are disabled.',
		}),
		async (ctx) => {
			const {harvestId} = ctx.req.valid('param');
			const {token} = ctx.req.valid('query');
			try {
				const result = await ctx.get('userContentRequestService').streamHarvestDownload({
					harvestId,
					token,
					range: ctx.req.header('range') ?? undefined,
					storageService: ctx.get('storageService'),
				});
				if (!result) {
					return ctx.text('Not Found', 404);
				}
				const headers = new Headers();
				headers.set('Content-Type', result.contentType ?? 'application/zip');
				headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
				headers.set('Content-Length', String(result.contentLength));
				headers.set('Cache-Control', 'private, no-store');
				headers.set('Accept-Ranges', 'bytes');
				if (result.contentRange) {
					headers.set('Content-Range', result.contentRange);
				}
				return new Response(Readable.toWeb(result.body) as ReadableStream, {
					status: result.contentRange ? 206 : 200,
					headers,
				});
			} catch (error) {
				if (error instanceof StorageObjectRangeNotSatisfiableError) {
					return ctx.text('Range Not Satisfiable', 416);
				}
				throw error;
			}
		},
	);
	app.get(
		'/users/@me/harvest/:harvestId/download',
		RateLimitMiddleware(RateLimitConfigs.USER_HARVEST_DOWNLOAD),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', HarvestIdParam),
		OpenAPI({
			operationId: 'get_data_harvest_download_url',
			summary: 'Get data harvest download URL',
			responseSchema: HarvestDownloadUrlResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieves the download URL for a completed data harvest. The URL is temporary and expires after a set time. Can only be accessed for completed harvests.',
		}),
		async (ctx) => {
			const {harvestId} = ctx.req.valid('param');
			const result = await ctx.get('userContentRequestService').getHarvestDownloadUrl({
				userId: ctx.get('user').id,
				harvestId,
				storageService: ctx.get('storageService'),
			});
			return ctx.json(result, 200);
		},
	);
}
