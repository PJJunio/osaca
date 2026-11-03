// SPDX-License-Identifier: AGPL-3.0-or-later

import {generateKeyPairSync} from 'node:crypto';
import {loadConfig, resetConfig} from '@osaca/config/src/ConfigLoader';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

const MINIMAL_ENV: Record<string, string> = {
	OSACA_ENV: 'test',
	OSACA_BASE_DOMAIN: 'localhost',
	OSACA_PUBLIC_SCHEME: 'http',
	OSACA_PUBLIC_PORT: '8088',
	OSACA_CASSANDRA_HOSTS: '127.0.0.1',
	OSACA_CASSANDRA_PORT: '9042',
	OSACA_CASSANDRA_KEYSPACE: 'osaca_test',
	OSACA_CASSANDRA_LOCAL_DC: 'datacenter1',
	OSACA_CASSANDRA_USERNAME: 'test-user',
	OSACA_CASSANDRA_PASSWORD: 'test-password',
	OSACA_S3_ENDPOINT: 'http://127.0.0.1:3900',
	OSACA_S3_ACCESS_KEY_ID: 'test-key',
	OSACA_S3_SECRET_ACCESS_KEY: 'test-secret',
	OSACA_MEDIA_PROXY_SECRET_KEY: 'test-media-secret',
	OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
	OSACA_ADMIN_SECRET_KEY_BASE: 'test-admin-secret',
	OSACA_ADMIN_OAUTH_CLIENT_SECRET: 'test-admin-oauth-secret',
	OSACA_GATEWAY_RPC_AUTH_TOKEN: 'test-gateway-token',
	OSACA_SUDO_MODE_SECRET: 'test-sudo-secret',
	OSACA_CONNECTION_INITIATION_SECRET: 'test-connection-secret',
	OSACA_PROFILE_PSEUDONYM_SECRET: 'test-profile-pseudonym-secret',
	OSACA_VAPID_PUBLIC_KEY: 'BB76bTFIuoqmxJtTfZX0yGTn1f_qu9H03B_nkj8OyExJFkN7Y-HBZZzShnHZoEhXKc5ZRy3jFu7OkBbnaQG-4aw',
	OSACA_VAPID_PRIVATE_KEY: 'Xgi-3P8J-I3Q6U1HlCcXMuc_tKLGAM9nIfznX3Hz68o',
};

function generateVapidPair(): {publicKey: string; privateKey: string} {
	const {privateKey} = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
	const jwk = privateKey.export({format: 'jwk'});
	const x = Buffer.from(jwk.x ?? '', 'base64url');
	const y = Buffer.from(jwk.y ?? '', 'base64url');
	const d = Buffer.from(jwk.d ?? '', 'base64url');
	return {
		publicKey: Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url'),
		privateKey: d.toString('base64url'),
	};
}

function stubMinimalEnv(overrides: Record<string, string> = {}): void {
	for (const [key, value] of Object.entries({...MINIMAL_ENV, ...overrides})) {
		vi.stubEnv(key, value);
	}
}

function clearOsacaEnv(): void {
	for (const key of Object.keys(process.env)) {
		if (key.startsWith('OSACA_')) {
			vi.stubEnv(key, undefined);
		}
	}
}

describe('ConfigLoader', () => {
	beforeEach(() => {
		resetConfig();
		clearOsacaEnv();
	});

	afterEach(() => {
		resetConfig();
		vi.unstubAllEnvs();
	});

	test('a self-hosted instance without OSACA_ENV runs in production', async () => {
		stubMinimalEnv({
			OSACA_SELF_HOSTED: 'true',
			OSACA_PROFILE_PSEUDONYM_SECRET: 'self-hosted-secret',
			OSACA_POSTGRES_HOST: 'postgres',
			OSACA_POSTGRES_DATABASE: 'osaca',
			OSACA_POSTGRES_PASSWORD: 'self-hosted-password',
		});
		vi.stubEnv('OSACA_ENV', undefined);
		expect((await loadConfig()).env).toBe('production');
	});

	test('reads the profile pseudonym secret and requires it in production', async () => {
		stubMinimalEnv();
		expect((await loadConfig()).auth.profile_pseudonym_secret).toBe('test-profile-pseudonym-secret');
		resetConfig();
		stubMinimalEnv({OSACA_PROFILE_PSEUDONYM_SECRET: ''});
		expect((await loadConfig()).auth.profile_pseudonym_secret).toBe('osaca-dev-profile-pseudonym-secret');
		resetConfig();
		stubMinimalEnv({
			OSACA_ENV: 'production',
			OSACA_POSTGRES_HOST: 'postgres.internal',
			OSACA_POSTGRES_DATABASE: 'osaca_prod',
			OSACA_POSTGRES_USERNAME: 'osaca_app',
			OSACA_POSTGRES_PASSWORD: 'prod-postgres-secret',
			OSACA_POSTGRES_SSL: 'true',
			OSACA_PROFILE_PSEUDONYM_SECRET: '',
		});
		await expect(loadConfig()).rejects.toThrow('OSACA_PROFILE_PSEUDONYM_SECRET is required');
	});

	test('rejects unsafe production Postgres defaults', async () => {
		stubMinimalEnv({OSACA_ENV: 'production'});
		await expect(loadConfig()).rejects.toThrow('OSACA_POSTGRES_HOST');
	});

	test('allows self-hosted production Postgres without TLS', async () => {
		stubMinimalEnv({
			OSACA_ENV: 'production',
			OSACA_SELF_HOSTED: 'true',
			OSACA_POSTGRES_HOST: 'postgres',
			OSACA_POSTGRES_DATABASE: 'osaca',
			OSACA_POSTGRES_USERNAME: 'osaca',
			OSACA_POSTGRES_PASSWORD: 'self-hosted-postgres-secret',
			OSACA_POSTGRES_SSL: 'false',
		});

		const config = await loadConfig();

		expect(config.instance.self_hosted).toBe(true);
		expect(config.database.postgres.ssl).toBe(false);
	});

	test('still requires TLS for non-self-hosted production Postgres', async () => {
		stubMinimalEnv({
			OSACA_ENV: 'production',
			OSACA_POSTGRES_HOST: 'postgres.internal',
			OSACA_POSTGRES_DATABASE: 'osaca_prod',
			OSACA_POSTGRES_USERNAME: 'osaca_app',
			OSACA_POSTGRES_PASSWORD: 'prod-postgres-secret',
			OSACA_POSTGRES_SSL: 'false',
		});

		await expect(loadConfig()).rejects.toThrow('OSACA_POSTGRES_SSL must be true');
	});

	test('rejects an App Store product mapped to an unknown slot', async () => {
		stubMinimalEnv({OSACA_APP_STORE_PRODUCTS: '{"com.osaca.visionary":"visionary"}'});
		await expect(loadConfig()).rejects.toThrow(
			'Invalid OSACA_APP_STORE_PRODUCTS slot for com.osaca.visionary: visionary',
		);
	});

	test('rejects a Google Play product mapped to an unknown slot', async () => {
		stubMinimalEnv({OSACA_GOOGLE_PLAY_PRODUCTS: '{"plutonium:weekly":"weekly"}'});
		await expect(loadConfig()).rejects.toThrow('Invalid OSACA_GOOGLE_PLAY_PRODUCTS slot for plutonium:weekly: weekly');
	});

	test('rejects a Google Play product key that does not fit its slot kind', async () => {
		stubMinimalEnv({OSACA_GOOGLE_PLAY_PRODUCTS: '{"plutonium":"monthly"}'});
		await expect(loadConfig()).rejects.toThrow(
			'OSACA_GOOGLE_PLAY_PRODUCTS key plutonium does not match its monthly slot',
		);
		resetConfig();
		stubMinimalEnv({OSACA_GOOGLE_PLAY_PRODUCTS: '{"gift:one":"gift_1_month"}'});
		await expect(loadConfig()).rejects.toThrow(
			'OSACA_GOOGLE_PLAY_PRODUCTS key gift:one does not match its gift_1_month slot',
		);
	});

	test('rejects a cache purge endpoint that contains credentials', async () => {
		stubMinimalEnv({
			OSACA_CACHE_PURGE_ADAPTER: 'http',
			OSACA_CACHE_PURGE_HTTP_ENDPOINT: 'https://purger:secret@purge.internal/purge',
		});
		await expect(loadConfig()).rejects.toThrow(
			'OSACA_CACHE_PURGE_HTTP_ENDPOINT must be an absolute http or https URL without credentials',
		);
	});

	test('rejects a cache purge token with spaces or control characters without echoing it', async () => {
		for (const token of ['secret\nvalue', 'secret\rvalue', 'secret value', 'secret-value\n']) {
			stubMinimalEnv({
				OSACA_CACHE_PURGE_ADAPTER: 'http',
				OSACA_CACHE_PURGE_HTTP_ENDPOINT: 'https://purge.internal/purge',
				OSACA_CACHE_PURGE_HTTP_TOKEN: token,
			});
			await expect(loadConfig()).rejects.toThrow(
				/^OSACA_CACHE_PURGE_HTTP_TOKEN must contain only visible ASCII characters$/,
			);
		}
	});

	test('rejects a controller cache purge endpoint that is not https', async () => {
		stubMinimalEnv({
			OSACA_CACHE_PURGE_ADAPTER: 'controller',
			OSACA_CACHE_PURGE_CONTROLLER_ENDPOINT: 'http://controller.test/v1/orgs/a/sites/b/purge',
			OSACA_CACHE_PURGE_CONTROLLER_TOKEN: 'pak_test',
		});
		await expect(loadConfig()).rejects.toThrow(
			'OSACA_CACHE_PURGE_CONTROLLER_ENDPOINT must be an absolute https URL without credentials',
		);
	});

	test('rejects a missing upload relay secret', async () => {
		stubMinimalEnv();
		vi.stubEnv('OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64', '');

		await expect(loadConfig()).rejects.toThrow('OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 is required');
	});

	test('rejects a non-base64 upload relay secret', async () => {
		stubMinimalEnv({OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: 'not base64!'});
		await expect(loadConfig()).rejects.toThrow('OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 must be base64');
	});

	test('rejects an upload relay secret shorter than 32 bytes', async () => {
		stubMinimalEnv({OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64: Buffer.alloc(16, 7).toString('base64')});
		await expect(loadConfig()).rejects.toThrow(
			'OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 must decode to at least 32 bytes',
		);
	});

	test('rejects a VAPID public key that is not a 65-byte uncompressed point', async () => {
		const {privateKey} = generateVapidPair();
		stubMinimalEnv({
			OSACA_VAPID_PUBLIC_KEY: Buffer.alloc(64, 4).toString('base64url'),
			OSACA_VAPID_PRIVATE_KEY: privateKey,
		});
		await expect(loadConfig()).rejects.toThrow(
			/^OSACA_VAPID_PUBLIC_KEY must be the base64url 65-byte uncompressed P-256 point\. Run rexctl doctor --fix/u,
		);
	});

	test('rejects a VAPID private key that is not a 32-byte scalar', async () => {
		const {publicKey} = generateVapidPair();
		stubMinimalEnv({
			OSACA_VAPID_PUBLIC_KEY: publicKey,
			OSACA_VAPID_PRIVATE_KEY: Buffer.alloc(31, 9).toString('base64url'),
		});
		await expect(loadConfig()).rejects.toThrow(
			/^OSACA_VAPID_PRIVATE_KEY must be the base64url 32-byte P-256 scalar\. Run rexctl doctor --fix/u,
		);
	});

	test('rejects a well formed VAPID scalar that does not derive the public point', async () => {
		const {publicKey} = generateVapidPair();
		const other = generateVapidPair();
		stubMinimalEnv({
			OSACA_VAPID_PUBLIC_KEY: publicKey,
			OSACA_VAPID_PRIVATE_KEY: other.privateKey,
		});
		await expect(loadConfig()).rejects.toThrow('OSACA_VAPID_PRIVATE_KEY does not match OSACA_VAPID_PUBLIC_KEY');
	});

	test('accepts a generated VAPID pair', async () => {
		const pair = generateVapidPair();
		stubMinimalEnv({
			OSACA_VAPID_PUBLIC_KEY: pair.publicKey,
			OSACA_VAPID_PRIVATE_KEY: pair.privateKey,
		});

		const config = await loadConfig();

		expect(config.auth.vapid.public_key).toBe(pair.publicKey);
		expect(config.auth.vapid.private_key).toBe(pair.privateKey);
	});

	test('inserts the public port into every other public url the config contains', async () => {
		stubMinimalEnv({
			OSACA_S3_PUBLIC_ENDPOINT: 'http://localhost/s3',
			OSACA_EMAIL_APP_BASE_URL: 'http://localhost',
			OSACA_AUTH_BLUESKY_CLIENT_URI: 'http://localhost',
			OSACA_AUTH_BLUESKY_TOS_URI: 'http://localhost/terms',
			OSACA_APP_ICON_URL: 'http://localhost/icon.png',
			OSACA_LIVEKIT_INTERNAL_URL: 'http://livekit:7880',
		});

		const config = await loadConfig();

		expect(config.s3?.presigned_url_base).toBe('http://localhost:8088/s3');
		expect(config.integrations.email.app_base_url).toBe('http://localhost:8088');
		expect(config.auth.bluesky.client_uri).toBe('http://localhost:8088');
		expect(config.auth.bluesky.tos_uri).toBe('http://localhost:8088/terms');
		expect(config.instance.branding.icon_url).toBe('http://localhost:8088/icon.png');
		expect(config.integrations.voice.internal_url).toBe('http://livekit:7880');
	});
});

describe('OSACA_PUBLIC_ORIGIN', () => {
	beforeEach(() => {
		resetConfig();
		clearOsacaEnv();
	});

	afterEach(() => {
		resetConfig();
		vi.unstubAllEnvs();
	});

	test('a ported origin ports every derived endpoint and every compose override', async () => {
		stubMinimalEnv({
			OSACA_BASE_DOMAIN: 'chat.example.com',
			OSACA_PUBLIC_SCHEME: 'https',
			OSACA_PUBLIC_PORT: '',
			OSACA_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
			OSACA_MARKETING_ENDPOINT: 'https://chat.example.com:29080',
			OSACA_MEDIA_ENDPOINT: 'https://chat.example.com:29080/media',
			OSACA_MEDIA_PROXY_UPLOAD_RELAY_ENDPOINT: 'https://chat.example.com:29080/media',
			OSACA_LIVEKIT_URL: 'https://chat.example.com:29080/livekit',
			OSACA_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(29080);
		expect(config.domain.public_origin).toBe('https://chat.example.com:29080');
		expect(config.endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(config.endpoints.app).toBe('https://chat.example.com:29080');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(config.endpoints.admin).toBe('https://chat.example.com:29080/admin');
		expect(config.endpoints.marketing).toBe('https://chat.example.com:29080');
		expect(config.endpoints.media).toBe('https://chat.example.com:29080/media');
		expect(config.services.media_proxy.upload_relay.endpoint).toBe('https://chat.example.com:29080/media');
		expect(config.integrations.voice.url).toBe('https://chat.example.com:29080/livekit');
		expect(config.auth.passkeys.additional_allowed_origins).toEqual(['https://chat.example.com:29080']);
	});

	test('the origin port wins over a OSACA_PUBLIC_PORT that disagrees', async () => {
		stubMinimalEnv({
			OSACA_BASE_DOMAIN: 'chat.example.com',
			OSACA_PUBLIC_SCHEME: 'https',
			OSACA_PUBLIC_PORT: '443',
			OSACA_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(29080);
		expect(config.endpoints.app).toBe('https://chat.example.com:29080');
		expect(config.endpoints.api_client).toBe('https://chat.example.com:29080/api');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
		expect(config.endpoints.admin).toBe('https://chat.example.com:29080/admin');
	});

	test('accepts an origin whose port matches OSACA_PUBLIC_PORT', async () => {
		stubMinimalEnv({
			OSACA_BASE_DOMAIN: 'chat.example.com',
			OSACA_PUBLIC_SCHEME: 'https',
			OSACA_PUBLIC_PORT: '29080',
			OSACA_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		expect((await loadConfig()).endpoints.gateway).toBe('wss://chat.example.com:29080/gateway');
	});

	test('normalizes an origin written with an explicit default port', async () => {
		stubMinimalEnv({
			OSACA_BASE_DOMAIN: 'chat.example.com',
			OSACA_PUBLIC_SCHEME: 'https',
			OSACA_PUBLIC_PORT: '443',
			OSACA_PUBLIC_ORIGIN: 'https://chat.example.com:443',
			OSACA_ADMIN_ENDPOINT: 'https://chat.example.com/admin',
		});

		const config = await loadConfig();

		expect(config.domain.public_port).toBe(443);
		expect(config.domain.public_origin).toBe('https://chat.example.com');
		expect(config.endpoints.admin).toBe('https://chat.example.com/admin');
		expect(config.endpoints.app).toBe('https://chat.example.com');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});

	test('takes the scheme and the domain from the origin when neither is set', async () => {
		stubMinimalEnv({
			OSACA_BASE_DOMAIN: '',
			OSACA_PUBLIC_SCHEME: '',
			OSACA_PUBLIC_PORT: '',
			OSACA_PUBLIC_ORIGIN: 'https://chat.example.com:29080',
		});

		const config = await loadConfig();

		expect(config.domain.base_domain).toBe('chat.example.com');
		expect(config.domain.public_scheme).toBe('https');
		expect(config.domain.public_port).toBe(29080);
	});

	test('the origin scheme wins over a OSACA_PUBLIC_SCHEME that disagrees', async () => {
		stubMinimalEnv({
			OSACA_BASE_DOMAIN: 'chat.example.com',
			OSACA_PUBLIC_SCHEME: 'http',
			OSACA_PUBLIC_PORT: '',
			OSACA_PUBLIC_ORIGIN: 'https://chat.example.com',
		});

		const config = await loadConfig();

		expect(config.domain.public_scheme).toBe('https');
		expect(config.endpoints.app).toBe('https://chat.example.com');
		expect(config.endpoints.gateway).toBe('wss://chat.example.com/gateway');
	});

	test('the origin host wins over a OSACA_BASE_DOMAIN that disagrees', async () => {
		stubMinimalEnv({
			OSACA_BASE_DOMAIN: 'chat.example.com',
			OSACA_PUBLIC_SCHEME: 'https',
			OSACA_PUBLIC_PORT: '',
			OSACA_PUBLIC_ORIGIN: 'https://other.example.com',
		});

		const config = await loadConfig();

		expect(config.domain.base_domain).toBe('other.example.com');
		expect(config.endpoints.app).toBe('https://other.example.com');
	});

	test('refuses to boot on an origin that is not a bare origin', async () => {
		stubMinimalEnv({OSACA_PUBLIC_ORIGIN: 'https://chat.example.com/app'});
		await expect(loadConfig()).rejects.toThrow(
			'OSACA_PUBLIC_ORIGIN must be a scheme, host and optional port such as https://chat.example.com:8443',
		);
	});

	test('leaves the derived origin canonical when nothing is set', async () => {
		stubMinimalEnv();
		expect((await loadConfig()).domain.public_origin).toBe('http://localhost:8088');
	});
});
