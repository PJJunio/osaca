// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AuthSessionResponse} from '@osaca/schema/src/domains/auth/AuthSchemas';

export class AuthSession {
	readonly id: string;
	readonly approxLastUsedAt: Date | null;
	readonly clientOs: string | null;
	readonly clientPlatform: string | null;
	readonly clientBrowser: string | null;
	readonly clientDevice: 'mobile' | 'desktop';
	readonly isCurrent: boolean;
	private readonly clientInfo: AuthSessionResponse['client_info'] | null;

	constructor(data: AuthSessionResponse) {
		this.id = data.id_hash;
		this.approxLastUsedAt = data.approx_last_used_at ? new Date(data.approx_last_used_at) : null;
		this.clientInfo = data.client_info ?? null;
		this.clientOs = this.clientInfo?.os ?? null;
		this.clientPlatform = this.clientInfo?.platform ?? null;
		this.clientBrowser = this.clientInfo?.browser ?? null;
		this.clientDevice = this.clientInfo?.device ?? 'desktop';
		this.isCurrent = data.current;
	}

	toJSON(): AuthSessionResponse {
		return {
			id_hash: this.id,
			approx_last_used_at: this.approxLastUsedAt?.toISOString() ?? null,
			client_info: this.clientInfo,
			current: this.isCurrent,
		};
	}
}
