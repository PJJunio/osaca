// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash} from 'node:crypto';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {createMiddleware} from 'hono/factory';

export function hashRequestToken(token: string): string {
	return createHash('sha256').update(token).digest('hex').slice(0, 32);
}

export function recordRequestStatus(_request: Request, _status: number): void {}

export function recordAuthFailure(_ip: string | null, _tokenHash: string | null): void {}

export const RequestErrorTelemetry = createMiddleware<HonoEnv>(async (_ctx, next) => {
	await next();
});

export function startRequestErrorTelemetry(): void {}

export function stopRequestErrorTelemetry(): void {}
