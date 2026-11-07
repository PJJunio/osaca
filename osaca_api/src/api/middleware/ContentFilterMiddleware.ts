// SPDX-License-Identifier: AGPL-3.0-or-later

import {createMiddleware} from 'hono/factory';

const SKIP_FIELDS = new Set([
	'acls',
	'allow',
	'avatar',
	'banner',
	'challenge',
	'channels',
	'content_type',
	'deny',
	'encryption_key',
	'endpoint',
	'embed_splash',
	'flags',
	'hashes',
	'icon',
	'id',
	'ids',
	'image',
	'keys',
	'locale',
	'mfa_code',
	'new_password',
	'nonce',
	'old_endpoint',
	'original_proof',
	'password',
	'permission_overwrites',
	'permissions',
	'recipients',
	'response',
	'roles',
	'secret',
	'splash',
	'state',
	'synced_preferences',
	'thumbnail',
	'ticket',
	'token',
	'traits',
	'upload_filename',
	'upload_id',
	'users',
	'verification_proof',
	'waveform',
	'webauthn_challenge',
	'webauthn_response',
]);
const SKIP_FIELD_SUFFIXES = [
	'_challenge',
	'_flags',
	'_hash',
	'_hashes',
	'_id',
	'_ids',
	'_key',
	'_keys',
	'_proof',
	'_secret',
	'_token',
	'_tokens',
] as const;
const SKIP_CONTENT_FILTER_PATH_PARTS = [
	'/admin/blocklists/phrase/',
	'/admin/blocklists/url-domain/',
	'/admin/blocklists/url/',
	'/auth/',
	'/oauth2/',
	'/users/@me/authorized-ips',
	'/users/@me/mfa/',
	'/users/@me/sudo/',
	'/webhooks/',
] as const;

export function shouldSkipContentFilterPath(path: string): boolean {
	return SKIP_CONTENT_FILTER_PATH_PARTS.some((part) => path.includes(part));
}

function shouldSkipField(key: string): boolean {
	if (SKIP_FIELDS.has(key)) {
		return true;
	}
	return SKIP_FIELD_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

export function extractStringValues(body: unknown, depth = 0): Array<string> {
	if (depth > 10) return [];
	const strings: Array<string> = [];
	if (typeof body === 'string') {
		strings.push(body);
	} else if (Array.isArray(body)) {
		for (const item of body) {
			strings.push(...extractStringValues(item, depth + 1));
		}
	} else if (body && typeof body === 'object') {
		for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
			if (shouldSkipField(key)) continue;
			if (typeof value === 'string' && value.length > 0) {
				strings.push(value);
			} else if (typeof value === 'object' && value !== null) {
				strings.push(...extractStringValues(value, depth + 1));
			}
		}
	}
	return strings;
}

const ContentFilterMiddleware = createMiddleware(async (_ctx, next) => next());

export default ContentFilterMiddleware;
