// SPDX-License-Identifier: AGPL-3.0-or-later

import dns from 'node:dns';
import type {ICacheService} from '@pkgs/cache/src/ICacheService';
import {seconds} from 'itty-time';

const REVERSE_DNS_CACHE_TTL_SECONDS = seconds('1 day');
const REVERSE_DNS_CACHE_PREFIX = 'reverse-dns:';

interface GetIpAddressReverseOptions {
	timeoutMs?: number;
	cacheTtlSeconds?: number;
}

export async function getIpAddressReverse(
	ip: string,
	cacheService?: ICacheService,
	options: GetIpAddressReverseOptions = {},
): Promise<string | null> {
	const cacheKey = `${REVERSE_DNS_CACHE_PREFIX}${ip}`;
	if (cacheService) {
		const cached = await cacheService.get<string | null>(cacheKey);
		if (cached !== null) return cached === '' ? null : cached;
	}
	let result: string | null = null;
	let timeout: NodeJS.Timeout | undefined;
	try {
		const reversePromise: Promise<Array<string>> = dns.promises.reverse(ip);
		let hostnames: Array<string>;
		if (options.timeoutMs !== undefined) {
			const timeoutMs = options.timeoutMs;
			const timeoutPromise = new Promise<Array<string>>((_, reject) => {
				timeout = setTimeout(() => reject(new Error(`reverse DNS timeout after ${timeoutMs}ms`)), timeoutMs);
			});
			hostnames = await Promise.race([reversePromise, timeoutPromise]);
		} else {
			hostnames = await reversePromise;
		}
		result = hostnames[0] ?? null;
	} catch {
		result = null;
	} finally {
		clearTimeout(timeout);
	}
	if (cacheService) {
		await cacheService.set(cacheKey, result ?? '', options.cacheTtlSeconds ?? REVERSE_DNS_CACHE_TTL_SECONDS);
	}
	return result;
}
