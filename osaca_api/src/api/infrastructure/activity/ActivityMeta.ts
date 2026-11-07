// SPDX-License-Identifier: AGPL-3.0-or-later

import {AsyncLocalStorage} from 'node:async_hooks';
import type {ChangeSource, Channel, Meta} from '@app/api/infrastructure/activity/Contract.generated';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {stripApiPrefix} from '@app/api/utils/RequestPathUtils';
import {parseAcceptLanguage} from '@osaca/i18n/src/locale/resolution/AcceptLanguageNegotiation';
import type {Context} from 'hono';
import {createMiddleware} from 'hono/factory';

const CANARY_ORIGINS = new Set(['https://canary.osaca.example', 'https://web.canary.osaca.example']);

export interface ActivityRequestContext {
	ip: string | null;
	ua: string | null;
	locale: string | null;
	requestId: string | null;
	channel: Channel;
	source: ChangeSource;
}

const requestContext = new AsyncLocalStorage<ActivityRequestContext>();
const sourceContext = new AsyncLocalStorage<ChangeSource>();
let processChannel: Channel = 'other';

export function setActivityProcessChannel(channel: Channel): void {
	processChannel = channel;
}

function activityMetaFromContext(ctx: Context<HonoEnv>): ActivityRequestContext {
	const origin = ctx.req.header('origin');
	const acceptLanguage = ctx.req.header('accept-language');
	return {
		ip: null,
		ua: null,
		locale: acceptLanguage ? parseAcceptLanguage(acceptLanguage) : null,
		requestId: ctx.get('requestId') ?? null,
		channel: origin && CANARY_ORIGINS.has(origin) ? 'canary' : 'stable',
		source: stripApiPrefix(ctx.req.path).startsWith('/admin/') ? 'admin' : 'other',
	};
}

export const ActivityContextMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	await requestContext.run(activityMetaFromContext(ctx), next);
});

export function withAccountChangeSource<T>(source: ChangeSource, fn: () => T): T {
	return sourceContext.run(source, fn);
}

export function currentAccountChangeSource(): ChangeSource {
	return sourceContext.getStore() ?? requestContext.getStore()?.source ?? 'other';
}

export function anonymousActivityMeta(): Meta {
	const context = requestContext.getStore();
	return {
		...workerMeta(),
		channel: context?.channel ?? processChannel,
		request_id: context?.requestId ?? null,
	};
}

export function workerMeta(): Meta {
	return {ip: null, country: null, ua: null, locale: null, channel: 'worker', request_id: null};
}

export async function currentActivityMeta(): Promise<Meta> {
	const context = requestContext.getStore();
	if (!context) {
		return {...workerMeta(), channel: processChannel};
	}
	return {
		ip: context.ip,
		country: null,
		ua: context.ua,
		locale: context.locale,
		channel: context.channel,
		request_id: context.requestId,
	};
}
