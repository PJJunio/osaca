// SPDX-License-Identifier: AGPL-3.0-or-later

import {getInstanceConfigRepository} from '@app/api/middleware/ServiceSingletons';
import type {AuthSession} from '@app/api/models/AuthSession';
import {resolveSessionClientInfo} from '@app/api/utils/SessionClientIdentity';
import {maskIpForDisplay} from '@osaca/ip_utils/src/IpAddress';
import type {AuthSessionResponse} from '@osaca/schema/src/domains/auth/AuthSchemas';
import {uint8ArrayToBase64} from 'uint8array-extras';

export async function mapAuthSessionsToResponse({
	authSessions,
	currentSessionIdHash,
}: {
	authSessions: Array<AuthSession>;
	currentSessionIdHash?: Uint8Array;
}): Promise<Array<AuthSessionResponse>> {
	const sortedSessions = authSessions.toSorted((a, b) => {
		const aTime = a.approximateLastUsedAt?.getTime() || 0;
		const bTime = b.approximateLastUsedAt?.getTime() || 0;
		return bTime - aTime;
	});
	const {branding} = await getInstanceConfigRepository().getAppPublicConfig();
	return sortedSessions.map((authSession): AuthSessionResponse => {
		const clientInfo = resolveSessionClientInfo({
			userAgent: authSession.clientUserAgent,
			reportedOs: authSession.clientOs ?? null,
			productName: branding.product_name,
		});
		const idHash = uint8ArrayToBase64(authSession.sessionIdHash, {urlSafe: true});
		const isCurrent = currentSessionIdHash ? authSession.sessionIdHash.equals(currentSessionIdHash) : false;
		return {
			id_hash: idHash,
			client_info: {
				platform: clientInfo.platform,
				os: clientInfo.os,
				browser: clientInfo.browser,
				device: clientInfo.device,
				location: null,
			},
			masked_ip: maskIpForDisplay(authSession.clientIp),
			approx_last_used_at: authSession.approximateLastUsedAt?.toISOString() || null,
			current: isCurrent,
		};
	});
}
