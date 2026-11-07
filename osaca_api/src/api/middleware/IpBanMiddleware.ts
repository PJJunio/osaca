// SPDX-License-Identifier: AGPL-3.0-or-later

import type {BannedIpKind} from '@app/api/admin/AdminRepository';
import {IP_BAN_REFRESH_CHANNEL} from '@app/api/constants/IpBan';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import {RefreshedCache} from '@app/api/utils/RefreshedCache';
import {getRequestClientIp} from '@app/api/utils/RequestClientIp';
import {createMiddleware} from 'hono/factory';

interface IpBanDecision {
	decisionId: bigint;
	reasonCode: number | null;
}

export interface IpBanMatch {
	ipAddress: string;
	matchedEntry: string;
	kind: BannedIpKind;
	expiresAt: Date | null;
	decision: IpBanDecision | null;
}

class IpBanCache extends RefreshedCache {
	constructor() {
		super({
			name: 'IP ban cache',
			channels: [IP_BAN_REFRESH_CHANNEL],
			periodicIntervalMs: () => null,
		});
	}

	protected async load(): Promise<void> {}

	resetCaches(): void {}

	isBanned(_ipString: string): boolean {
		return false;
	}

	getMatch(_ipString: string): IpBanMatch | null {
		return null;
	}

	ban(
		_ipOrCidr: string,
		_options?: {reason?: string | null; decisionId?: bigint | null; expiresAt?: Date | null},
	): void {}

	banTemp(_ipOrCidr: string, _ttlSeconds: number, _reason?: string | null): void {}

	unban(_ipOrCidr: string): void {}
}

export const ipBanCache = new IpBanCache();

export const IpBanMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	getRequestClientIp(ctx);
	await next();
});
