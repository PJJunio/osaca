// SPDX-License-Identifier: AGPL-3.0-or-later

import type {RouteRateLimitConfig} from '@app/api/middleware/RateLimitMiddleware';
import {ms} from 'itty-time';

export const InviteRateLimitConfigs = {
	INVITE_GET: {
		bucket: 'invite:read::invite_code',
		config: {limit: 100, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	// One budget per code shared by every visitor without a session, so reading a code does not depend on the address
	// (ADR-0017). Exempt from the global limit, which would otherwise be shared too.
	INVITE_GET_PER_CODE: {
		bucket: 'invite:read:code::invite_code',
		config: {limit: 300, windowMs: ms('1 minute'), exemptFromGlobal: true},
		sharedWithoutSession: true,
	} as RouteRateLimitConfig,
	INVITE_ACCEPT: {
		bucket: 'invite:accept',
		config: {limit: 10, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	INVITE_CREATE: {
		bucket: 'invite:create::channel_id',
		config: {limit: 20, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	INVITE_DELETE: {
		bucket: 'invite:delete::invite_code',
		config: {limit: 20, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	INVITE_LIST_CHANNEL: {
		bucket: 'invite:list::channel_id',
		config: {limit: 40, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	INVITE_LIST_GUILD: {
		bucket: 'invite:list::guild_id',
		config: {limit: 40, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
} as const;
