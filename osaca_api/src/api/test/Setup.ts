// SPDX-License-Identifier: AGPL-3.0-or-later

import {existsSync} from 'node:fs';
import type {UserID} from '@app/api/BrandedTypes';
import {buildAPIConfigFromMaster, initializeConfig} from '@app/api/Config';
import {setInjectedMessageResponseDataService} from '@app/api/channel/services/message/MessageResponseDataService';
import type {APIConfig} from '@app/api/config/APIConfig';
import {
	resetCassandraQueryExecutorForTesting,
	setCassandraQueryExecutorForTesting,
	shutdownCassandraQueryExecutorForTesting,
} from '@app/api/database/CassandraQueryExecution';
import type {IUsersServiceClient} from '@app/api/infrastructure/UsersServiceClient';
import {setInjectedUsersServiceClient} from '@app/api/infrastructure/UsersServiceClient';
import {initializeLogger} from '@app/api/Logger';
import {setInjectedKVProvider, setInjectedSnowflakeService} from '@app/api/middleware/ServiceRegistry';
import {getInstanceConfigRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {drainSearchTasks, enableSearchTaskTracking} from '@app/api/search/SearchTaskTracker';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {MockSnowflakeService} from '@app/api/test/mocks/MockSnowflakeService';
import {NoopLogger} from '@app/api/test/mocks/NoopLogger';
import {RepositoryBackedMessageResponseDataService} from '@app/api/test/mocks/RepositoryBackedMessageResponseDataService';
import {server} from '@app/api/test/msw/server';
import {mapUserToPartialResponse} from '@app/api/user/UserMappers';
import {loadConfig} from '@osaca/config/src/ConfigLoader';
import type {UserPartialResponse} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {MockKVProvider} from '@pkgs/kv_client/src/testing/MockKVProvider';
import {afterAll, afterEach, beforeAll} from 'vitest';

function defaultNatsUrl(): string {
	return `nats://${existsSync('/.dockerenv') ? 'nats' : '127.0.0.1'}:4222`;
}

function setDefaultTestEnv(): void {
	// API tests use a non-self-hosted baseline; self-hosted scenarios override the loaded config explicitly.
	process.env.OSACA_SELF_HOSTED = 'false';

	const natsUrl = defaultNatsUrl();
	const defaults: Record<string, string> = {
		OSACA_ENV: 'test',
		OSACA_BASE_DOMAIN: 'localhost',
		OSACA_PUBLIC_SCHEME: 'http',
		OSACA_PUBLIC_PORT: '8088',
		OSACA_TRUST_CLIENT_IP_HEADER: 'true',
		OSACA_CLIENT_IP_HEADER_NAME: 'x-forwarded-for',
		OSACA_CASSANDRA_HOSTS: '127.0.0.1',
		OSACA_CASSANDRA_PORT: '9042',
		OSACA_CASSANDRA_KEYSPACE: 'osaca_test',
		OSACA_CASSANDRA_LOCAL_DC: 'datacenter1',
		OSACA_CASSANDRA_USERNAME: 'cassandra',
		OSACA_CASSANDRA_PASSWORD: 'cassandra',
		OSACA_KV_URL: 'redis://127.0.0.1:6379/0',
		OSACA_NATS_URL: natsUrl,
		OSACA_NATS_CORE_URL: natsUrl,
		OSACA_NATS_JETSTREAM_URL: natsUrl,
		OSACA_INTERNAL_MEDIA_PROXY_ENDPOINT: 'http://127.0.0.1:8088/media',
		OSACA_S3_ENDPOINT: 'http://127.0.0.1:3900',
		OSACA_S3_REGION: 'local',
		OSACA_S3_ACCESS_KEY_ID: 'test',
		OSACA_S3_SECRET_ACCESS_KEY: 'test',
		OSACA_API_PRESIGNED_ATTACHMENT_UPLOADS_ENABLED: 'false',
		OSACA_MEDIA_PROXY_SECRET_KEY: 'test-media-secret',
		OSACA_MEDIA_PROXY_ATTACHMENT_URL_SECRETS_BASE64: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
		OSACA_ADMIN_SECRET_KEY_BASE: 'test-admin-secret',
		OSACA_ADMIN_OAUTH_CLIENT_SECRET: 'test-admin-oauth-secret',
		OSACA_GATEWAY_RPC_AUTH_TOKEN: 'test-gateway-rpc-token',
		OSACA_SUDO_MODE_SECRET: 'test-sudo-secret',
		OSACA_CONNECTION_INITIATION_SECRET: 'test-connection-secret',
		OSACA_VAPID_PUBLIC_KEY: 'BB76bTFIuoqmxJtTfZX0yGTn1f_qu9H03B_nkj8OyExJFkN7Y-HBZZzShnHZoEhXKc5ZRy3jFu7OkBbnaQG-4aw',
		OSACA_VAPID_PRIVATE_KEY: 'Xgi-3P8J-I3Q6U1HlCcXMuc_tKLGAM9nIfznX3Hz68o',
		OSACA_VAPID_EMAIL: 'test@example.com',
		OSACA_PASSKEY_RP_NAME: 'OSACA Test',
		OSACA_PASSKEY_RP_ID: 'localhost',
		OSACA_PASSKEY_ADDITIONAL_ALLOWED_ORIGINS: 'http://localhost',
		OSACA_EMAIL_ENABLED: 'true',
		OSACA_EMAIL_PROVIDER: 'smtp',
		OSACA_EMAIL_FROM_EMAIL: 'noreply@example.com',
		OSACA_EMAIL_SMTP_HOST: 'localhost',
		OSACA_EMAIL_SMTP_PORT: '1025',
		OSACA_EMAIL_SMTP_USERNAME: 'test',
		OSACA_EMAIL_SMTP_PASSWORD: 'test',
		OSACA_EMAIL_SMTP_TLS_MODE: 'none',
		OSACA_LIVEKIT_ENABLED: 'false',
		OSACA_STRIPE_ENABLED: 'true',
		OSACA_SEARCH_ENGINE: 'elasticsearch',
		OSACA_SEARCH_URL: 'http://127.0.0.1:9200',
		OSACA_SEARCH_API_KEY: 'test',
		OSACA_DISCOVERY_ENABLED: 'true',
		OSACA_RELAX_REGISTRATION_RATE_LIMITS: 'true',
		OSACA_DISABLE_RATE_LIMITS: 'true',
		OSACA_TEST_MODE_ENABLED: 'true',
	};
	for (const [key, value] of Object.entries(defaults)) {
		process.env[key] ??= value;
	}
}

class RepositoryBackedUsersServiceClient implements IUsersServiceClient {
	async getUserPartialResponses(userIds: Array<UserID>): Promise<Map<UserID, UserPartialResponse>> {
		const userRepository = getUserRepository();
		const result = new Map<UserID, UserPartialResponse>();
		for (const userId of userIds) {
			const user = await userRepository.findUnique(userId);
			if (user) {
				result.set(userId, mapUserToPartialResponse(user));
			}
		}
		return result;
	}

	async invalidateUserCache(_userId: UserID): Promise<void> {}
}

setDefaultTestEnv();
process.env.OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 ??= 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';

const master = await loadConfig();
const apiConfig = buildAPIConfigFromMaster(master);
const testApiConfig: APIConfig = {
	...apiConfig,
	auth: {
		...apiConfig.auth,
		passkeys: {
			...apiConfig.auth.passkeys,
			rpId: 'localhost',
			allowedOrigins: ['http://localhost'],
		},
	},
	voice: {
		...apiConfig.voice,
		enabled: false,
	},
};
testApiConfig.dev.relaxRegistrationRateLimits = true;
testApiConfig.dev.disableRateLimits = true;
testApiConfig.dev.testModeEnabled = true;

initializeConfig(testApiConfig);

const bootstrapLogger = new NoopLogger();

initializeLogger(bootstrapLogger);

setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());

setInjectedKVProvider(new MockKVProvider());
setInjectedSnowflakeService(new MockSnowflakeService({startTimestampMs: Date.now()}));
setInjectedUsersServiceClient(new RepositoryBackedUsersServiceClient());
setInjectedMessageResponseDataService(new RepositoryBackedMessageResponseDataService());

enableSearchTaskTracking();

beforeAll(async () => {
	server.listen({
		onUnhandledRequest: 'error',
	});
});

afterEach(async () => {
	await drainSearchTasks();
	resetCassandraQueryExecutorForTesting();
	getInstanceConfigRepository().clearCacheForTesting();
	server.resetHandlers();
});

afterAll(async () => {
	server.close();
	await shutdownCassandraQueryExecutorForTesting();
});
