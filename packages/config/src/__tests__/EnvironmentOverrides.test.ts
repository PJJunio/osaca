// SPDX-License-Identifier: AGPL-3.0-or-later

import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildNamedOsacaEnvOverrides, readEnvValue} from '@osaca/config/src/config_loader/EnvironmentOverrides';
import {afterAll, describe, expect, test} from 'vitest';

describe('buildNamedOsacaEnvOverrides', () => {
	test.each(['', ' ', '\t\n'])('treats %j as unset for every value type', (blank) => {
		expect(
			buildNamedOsacaEnvOverrides({
				OSACA_BASE_DOMAIN: blank,
				OSACA_API_PORT: blank,
				OSACA_S3_FORCE_PATH_STYLE: blank,
				OSACA_API_IP_BAN_EXEMPT_IPS: blank,
				OSACA_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: blank,
				OSACA_LIVEKIT_DEFAULT_REGION: blank,
				OSACA_VOICE_P2P_STUN_URLS: blank,
				OSACA_AUTH_BLUESKY_KEYS: blank,
				OSACA_EMAIL_FROM_NAME: blank,
				OSACA_EMAIL_REPLY_TO_EMAIL: blank,
				OSACA_EMAIL_FALLBACK_DOMAINS: blank,
				OSACA_EMAIL_FALLBACK_SMTP_HOST: blank,
				OSACA_EMAIL_FALLBACK_SMTP_HEADERS: blank,
			}),
		).toEqual({});
	});

	test('the canonical name wins over its alias regardless of declaration order', () => {
		expect(
			buildNamedOsacaEnvOverrides({
				OSACA_MEDIA_PROXY_ENDPOINT: 'http://alias',
				OSACA_INTERNAL_MEDIA_PROXY_ENDPOINT: 'http://canonical',
				OSACA_NATS_CORE_URL: 'nats://alias',
				OSACA_NATS_URL: 'nats://canonical',
			}),
		).toMatchObject({
			internal: {media_proxy: 'http://canonical'},
			services: {nats: {core_url: 'nats://canonical'}},
		});
	});
});

describe('readEnvValue with NAME_FILE', () => {
	const dir = mkdtempSync(join(tmpdir(), 'osaca-env-file-'));
	afterAll(() => rmSync(dir, {recursive: true, force: true}));

	function secretFile(name: string, contents: string): string {
		const path = join(dir, name);
		writeFileSync(path, contents);
		return path;
	}

	test('reads the value from NAME_FILE when NAME is unset', () => {
		const path = secretFile('plain', 'from-file\n');
		expect(readEnvValue({OSACA_SUDO_MODE_SECRET_FILE: path}, 'OSACA_SUDO_MODE_SECRET')).toBe('from-file');
	});

	test('reads the value from NAME_FILE when NAME is blank', () => {
		const path = secretFile('blank', 'from-file');
		expect(
			readEnvValue({OSACA_SUDO_MODE_SECRET: ' ', OSACA_SUDO_MODE_SECRET_FILE: path}, 'OSACA_SUDO_MODE_SECRET'),
		).toBe('from-file');
	});

	test('trims only one trailing newline', () => {
		const crlf = secretFile('crlf', 'value\r\n');
		const multi = secretFile('multi', '-----BEGIN-----\nabc\n-----END-----\n\n');
		expect(readEnvValue({X_FILE: crlf}, 'X')).toBe('value');
		expect(readEnvValue({X_FILE: multi}, 'X')).toBe('-----BEGIN-----\nabc\n-----END-----\n');
	});

	test('treats an empty file as unset', () => {
		const path = secretFile('empty', '\n');
		expect(readEnvValue({X_FILE: path}, 'X')).toBeUndefined();
	});

	test('keeps NAME when NAME_FILE is blank', () => {
		expect(readEnvValue({X: 'direct', X_FILE: ''}, 'X')).toBe('direct');
	});

	test('rejects NAME and NAME_FILE together', () => {
		const path = secretFile('both', 'from-file');
		expect(() => readEnvValue({X: 'direct', X_FILE: path}, 'X')).toThrow('X and X_FILE are both set, set only one');
	});

	test('names NAME_FILE and the path when the file is missing', () => {
		const path = join(dir, 'missing');
		expect(() => readEnvValue({X_FILE: path}, 'X')).toThrow(`X_FILE could not read ${path} (ENOENT)`);
	});

	test('rejects a file that is not valid UTF-8', () => {
		const path = join(dir, 'binary');
		writeFileSync(path, Buffer.from([0xff, 0x61]));
		expect(() => readEnvValue({X_FILE: path}, 'X')).toThrow(`X_FILE could not read ${path} (`);
	});

	test('feeds named overrides and aliases', () => {
		const secret = secretFile('youtube', 'yt_test_file\n');
		const nats = secretFile('nats', 'nats://nats:4222\n');
		expect(
			buildNamedOsacaEnvOverrides({OSACA_YOUTUBE_API_KEY_FILE: secret, OSACA_NATS_CORE_URL_FILE: nats}),
		).toMatchObject({
			integrations: {youtube: {api_key: 'yt_test_file'}},
			services: {nats: {core_url: 'nats://nats:4222'}},
		});
	});
});
