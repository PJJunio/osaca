// SPDX-License-Identifier: AGPL-3.0-or-later

import type {CacheHeadersOptions} from '@osaca/hono/src/middleware/CacheHeaders';
import {cacheHeaders} from '@osaca/hono/src/middleware/CacheHeaders';
import type {CorsOptions} from '@osaca/hono/src/middleware/Cors';
import {cors} from '@osaca/hono/src/middleware/Cors';
import type {RequestIdOptions} from '@osaca/hono/src/middleware/RequestId';
import {requestId} from '@osaca/hono/src/middleware/RequestId';
import {osacaVersionHeader} from '@osaca/hono/src/middleware/VersionHeader';
import type {Env, Hono, MiddlewareHandler} from 'hono';

interface MiddlewareStackOptions {
	requestId?: RequestIdOptions;
	cors?: CorsOptions;
	cacheHeaders?: CacheHeadersOptions | false;
}

function createStandardMiddlewareStack(options: MiddlewareStackOptions): Array<MiddlewareHandler> {
	const stack: Array<MiddlewareHandler> = [osacaVersionHeader()];
	if (options.requestId) {
		stack.push(requestId(options.requestId));
	}
	if (options.cors && options.cors.enabled !== false) {
		stack.push(cors(options.cors));
	}
	if (options.cacheHeaders !== false) {
		stack.push(cacheHeaders(options.cacheHeaders ?? {}));
	}
	return stack;
}

export function applyMiddlewareStack<E extends Env = Env>(app: Hono<E>, options: MiddlewareStackOptions = {}): void {
	for (const middleware of createStandardMiddlewareStack(options)) {
		app.use('*', middleware);
	}
}
