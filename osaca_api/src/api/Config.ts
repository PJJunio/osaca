// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIConfig, BlueskyOAuthConfig, TrustedCallerConfig} from '@app/api/config/APIConfig';
import {parseIpBanEntry} from '@app/api/utils/IpRangeUtils';
import {trimTrailingSlash} from '@app/api/utils/UrlUtils';
import type {WorkerTaskName} from '@app/api/worker/WorkerLaneConfig';
import type {MasterConfig} from '@osaca/config/src/MasterConfig';
import {parseIpAddress} from '@osaca/ip_utils/src/IpAddress';
import {normalizeString} from '@osaca/schema/src/primitives/SchemaPrimitives';

function extractHostname(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		throw new Error(`Invalid URL: ${url}`);
	}
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

function resolveValidateResponses(master: MasterConfig): boolean {
	if (isBoolean(master.dev.validate_responses)) {
		return master.dev.validate_responses;
	}
	return master.env !== 'production';
}

function resolveTrustClientIpHeader(proxyConfig: object): boolean {
	const configuredValue = Reflect.get(proxyConfig, 'trust_client_ip_header');
	if (isBoolean(configuredValue)) {
		return configuredValue;
	}
	return false;
}

function normalizeIpBanExemptIps(values: Array<string>): Array<string> {
	const normalized = new Set<string>();
	for (const value of values) {
		if (value.includes('/')) {
			const range = parseIpBanEntry(value);
			if (range?.type !== 'range') {
				throw new Error(`OSACA_API_IP_BAN_EXEMPT_IPS contains an invalid CIDR range: ${value}`);
			}
			normalized.add(range.canonical);
			continue;
		}
		const parsed = parseIpAddress(value);
		if (!parsed) {
			throw new Error(`OSACA_API_IP_BAN_EXEMPT_IPS contains an invalid IP address: ${value}`);
		}
		normalized.add(parsed.normalized);
	}
	return Array.from(normalized);
}

const TRUSTED_CALLER_MIN_KEY_LENGTH = 32;

function parseTrustedCaller(entry: unknown, index: number): TrustedCallerConfig {
	const label = `OSACA_API_TRUSTED_CALLERS entry ${index + 1}`;
	if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
		throw new Error(`${label} must be a JSON object`);
	}
	const name = Reflect.get(entry, 'name');
	if (typeof name !== 'string' || name.trim().length === 0) {
		throw new Error(`${label} must have a name`);
	}
	const key = Reflect.get(entry, 'key');
	if (typeof key !== 'string' || key.trim().length < TRUSTED_CALLER_MIN_KEY_LENGTH) {
		throw new Error(`${label} key must be at least ${TRUSTED_CALLER_MIN_KEY_LENGTH} characters`);
	}
	const buckets = Reflect.get(entry, 'buckets');
	if (
		!Array.isArray(buckets) ||
		buckets.length === 0 ||
		!buckets.every((bucket) => typeof bucket === 'string' && bucket.trim().length > 0)
	) {
		throw new Error(`${label} buckets must be a non-empty list of bucket names`);
	}
	return {
		name: name.trim(),
		key: key.trim(),
		buckets: buckets.map((bucket: string) => bucket.trim()),
	};
}

function buildTrustedCallers(master: MasterConfig): Array<TrustedCallerConfig> {
	return (master.services.api.trusted_callers ?? []).map(parseTrustedCaller);
}

const SETUP_TOKEN_MIN_LENGTH = 32;
const SETUP_TOKEN_MAX_LENGTH = 256;

function resolveSetupToken(master: MasterConfig): string | null {
	const token = master.instance.setup.token?.trim();
	if (!token) return null;
	if (
		token.length < SETUP_TOKEN_MIN_LENGTH ||
		token.length > SETUP_TOKEN_MAX_LENGTH ||
		normalizeString(token) !== token
	) {
		throw new Error(
			`OSACA_SETUP_TOKEN must be ${SETUP_TOKEN_MIN_LENGTH} to ${SETUP_TOKEN_MAX_LENGTH} printable characters`,
		);
	}
	return token;
}

export function buildAPIConfigFromMaster(master: MasterConfig): APIConfig {
	if (!master.internal) {
		throw new Error('internal configuration is required for the API');
	}
	const postgresSource = master.database.postgres;
	const apiWorkerConfig = master.services.api?.worker;
	const s3Config = master.s3;
	const uploadRelayConfig = master.services.media_proxy.upload_relay;
	const uploadRelaySecretBase64 = uploadRelayConfig.secret_base64;
	if (uploadRelaySecretBase64.length === 0) {
		throw new Error('OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 is required for the API');
	}
	if (Buffer.from(uploadRelaySecretBase64, 'base64').length < 32) {
		throw new Error('OSACA_MEDIA_PROXY_UPLOAD_RELAY_SECRET_BASE64 must decode to at least 32 bytes');
	}
	const trustedCallers = buildTrustedCallers(master);
	if (!s3Config) {
		throw new Error('S3 configuration is required for the API');
	}
	const s3Buckets = s3Config.buckets ?? {
		cdn: '',
		uploads: '',
		reports: '',
		harvests: '',
	};
	if (!postgresSource) {
		throw new Error('Postgres configuration is required.');
	}
	return {
		nodeEnv: master.env === 'test' ? 'development' : master.env,
		port: master.services.api.port,
		headersTimeoutMs: master.services.api.headers_timeout_ms,
		requestTimeoutMs: master.services.api.request_timeout_ms,
		maxInflightRequests: master.services.api.max_inflight_requests,
		automatedMessageDeletionDelayDays: master.services.api.automated_message_deletion_delay_days,
		ipBanExemptIps: normalizeIpBanExemptIps(master.services.api.ip_ban_exempt_ips),
		postgres: {
			url: postgresSource?.url ?? '',
			host: postgresSource?.host ?? '127.0.0.1',
			port: postgresSource?.port ?? 5432,
			database: postgresSource?.database ?? 'osaca',
			username: postgresSource?.username ?? 'osaca',
			password: postgresSource?.password ?? 'osaca',
			ssl: postgresSource?.ssl ?? false,
			sslCa: postgresSource?.ssl_ca ?? '',
			maxConnections: postgresSource?.max_connections ?? 20,
			kvTable: postgresSource?.kv_table ?? 'osaca_kv',
			preparedStatements: postgresSource?.prepared_statements ?? true,
		},
		kv: {
			url: master.internal.kv,
			mode: master.internal.kv_mode,
		},
		nats: {
			coreUrl: master.services.nats?.core_url ?? 'nats://127.0.0.1:4222',
			jetStreamUrl: master.services.nats?.jetstream_url ?? 'nats://127.0.0.1:4223',
			authToken: master.services.nats?.auth_token ?? '',
		},
		storageChangeFeed: {
			enabled: master.services.api.storage_change_feed?.enabled ?? false,
			stream: master.services.api.storage_change_feed?.stream ?? 'STORAGE_CHANGES',
			skipBuckets: master.services.api.storage_change_feed?.skip_buckets ?? [s3Buckets.uploads],
		},
		search: {
			engine: master.integrations.search?.engine ?? 'elasticsearch',
			url: master.integrations.search?.url ?? 'http://127.0.0.1:9200',
			apiKey: master.integrations.search?.api_key ?? '',
			username: master.integrations.search?.username ?? '',
			password: master.integrations.search?.password ?? '',
			tlsRejectUnauthorized: master.integrations.search?.tls_reject_unauthorized ?? true,
		},
		mediaProxy: {
			host: extractHostname(master.internal.media_proxy),
			port: new URL(master.internal.media_proxy).port
				? Number.parseInt(new URL(master.internal.media_proxy).port, 10)
				: 80,
			secretKey: master.services.media_proxy.secret_key,
			uploadRelay: {
				endpoint: trimTrailingSlash(uploadRelayConfig.endpoint),
				relaySecretBase64: uploadRelaySecretBase64,
				maxBodyBytes: uploadRelayConfig.max_body_bytes,
				tokenTtlSecs: uploadRelayConfig.token_ttl_secs,
			},
			attachmentUrls: {
				secretsBase64: master.services.media_proxy.attachment_urls.secrets_base64,
			},
		},
		proxy: {
			trust_client_ip_header: resolveTrustClientIpHeader(master.proxy),
			client_ip_header: (Reflect.get(master.proxy, 'client_ip_header') as string | undefined) ?? 'x-forwarded-for',
		},
		endpoints: {
			apiPublic: master.endpoints.api,
			apiPublicDiscovery: master.services.api.discovery_public_endpoint || master.endpoints.api,
			apiTransportDiscovery: master.services.api.discovery_transport_endpoint || null,
			apiClient: master.endpoints.api_client,
			webApp: master.endpoints.app,
			webAppOrigins: [...new Set([new URL(master.endpoints.app).origin, ...master.services.api.app_origin_aliases])],
			gateway: master.endpoints.gateway,
			media: master.endpoints.media,
			marketing: master.endpoints.marketing,
			admin: master.endpoints.admin,
			invite: master.endpoints.invite,
			gift: master.endpoints.gift,
			staticCdn: master.endpoints.static_cdn,
		},
		internal: {
			gatewayRpcAuthToken: master.services.gateway.rpc_auth_token ?? '',
			trustedCallers,
		},
		hosts: {
			marketing: extractHostname(master.endpoints.marketing),
			unfurlIgnored: master.services.api.unfurl_ignored_hosts,
		},
		s3: {
			endpoint: s3Config.endpoint,
			presignedUrlBase: s3Config.presigned_url_base,
			forcePathStyle: s3Config.force_path_style,
			region: s3Config.region,
			accessKeyId: s3Config.access_key_id,
			secretAccessKey: s3Config.secret_access_key,
			buckets: s3Buckets,
		},
		blocklistFeeds: {
			enabled: master.integrations.blocklist_feeds.enabled ?? !master.instance.self_hosted,
		},
		breachedPasswordCheck: {
			enabled: master.integrations.breached_password_check.enabled ?? !master.instance.self_hosted,
		},
		voice: {
			enabled: master.integrations.voice.enabled,
			apiKey: master.integrations.voice.api_key,
			apiSecret: master.integrations.voice.api_secret,
			url: master.integrations.voice.url,
			internalUrl: master.integrations.voice.internal_url,
			bundled: master.integrations.voice.bundled ?? true,
			defaultRegion: master.integrations.voice.default_region,
			p2pStunUrls: master.integrations.voice.p2p_stun_urls,
			turnServers: master.integrations.voice.turn_servers ?? [],
			joinAllowPrivateEndpoints: master.integrations.voice.join_allow_private_endpoints ?? false,
			healthIntervalMs: master.integrations.voice.health_interval_ms ?? 15000,
		},
		cachePurge: {
			adapter: master.integrations.cache_purge.adapter,
			http: {
				endpoint: master.integrations.cache_purge.http.endpoint,
				token: master.integrations.cache_purge.http.token,
				timeoutMs: master.integrations.cache_purge.http.timeout_ms,
			},
			controller: {
				endpoint: master.integrations.cache_purge.controller.endpoint,
				token: master.integrations.cache_purge.controller.token,
				timeoutMs: master.integrations.cache_purge.controller.timeout_ms,
			},
		},
		clamav: {
			enabled: master.integrations.clamav.enabled,
			host: master.integrations.clamav.host,
			port: master.integrations.clamav.port,
			failOpen: master.integrations.clamav.fail_open,
		},
		admin: {
			oauthClientSecret: master.services.admin.oauth_client_secret,
		},
		auth: {
			sudoModeSecret: master.auth.sudo_mode_secret,
			connectionInitiationSecret: master.auth.connection_initiation_secret,
			profilePseudonymSecret: master.auth.profile_pseudonym_secret,
			passkeys: {
				rpName: master.auth.passkeys.rp_name,
				rpId: master.auth.passkeys.rp_id,
				allowedOrigins: master.auth.passkeys.additional_allowed_origins,
			},
			bluesky: master.auth.bluesky as BlueskyOAuthConfig,
		},
		youtube: {
			apiKey: master.integrations.youtube.api_key,
		},
		instance: {
			selfHosted: master.instance.self_hosted,
			baseDomain: master.domain.base_domain,
			autoJoinInviteCode: master.instance.auto_join_invite_code,
			branding: {
				productName: master.instance.branding.product_name,
				iconUrl: master.instance.branding.icon_url,
				symbolUrl: master.instance.branding.symbol_url,
				logoUrl: master.instance.branding.logo_url,
				wordmarkUrl: master.instance.branding.wordmark_url,
				faviconUrl: master.instance.branding.favicon_url,
				faviconDarkUrl: master.instance.branding.favicon_dark_url,
				signInBackdropUrl: master.instance.branding.sign_in_backdrop_url,
				themeColor: master.instance.branding.theme_color,
				statusPageUrl: master.instance.branding.status_page_url,
				statusPageIncidentHistoryUrl: master.instance.branding.status_page_incident_history_url,
			},
			setup: {
				configured: master.instance.setup.configured,
				token: resolveSetupToken(master),
			},
		},
		discovery: {
			enabled: master.discovery.enabled,
			minMemberCount: master.discovery.min_member_count,
		},
		dev: {
			relaxRegistrationRateLimits: master.dev.relax_registration_rate_limits,
			disableRateLimits: master.dev.disable_rate_limits,
			testModeEnabled: master.dev.test_mode_enabled,
			testHarnessToken: master.dev.test_harness_token,
			validateResponses: resolveValidateResponses(master),
		},
		presignedAttachmentUploadsEnabled: master.services.api.presigned_attachment_uploads_enabled ?? false,
		presignedHarvestDownloadsEnabled: master.services.api.presigned_harvest_downloads_enabled ?? true,
		attachmentDecayEnabled: master.attachment_decay_enabled,
		deletionGracePeriodHours: master.dev.test_mode_enabled ? 0.01 : master.deletion_grace_period_hours,
		reportRetention: {
			days: master.report_retention.days,
			dryRun: master.report_retention.dry_run,
		},
		push: {
			publicVapidKey: master.auth.vapid.public_key,
		},
		worker: {
			mode: apiWorkerConfig?.mode ?? 'all_lanes',
			laneName: apiWorkerConfig?.lane,
			taskName: apiWorkerConfig?.task as WorkerTaskName | undefined,
			enableCronScheduler: apiWorkerConfig?.enable_cron_scheduler,
			metricsPort: apiWorkerConfig?.metrics_port,
			embedded: apiWorkerConfig?.embedded ?? false,
			laneConcurrencyOverrides: {
				realtime: apiWorkerConfig?.lane_concurrency_overrides?.realtime,
				unfurl: apiWorkerConfig?.lane_concurrency_overrides?.unfurl,
				lifecycle: apiWorkerConfig?.lane_concurrency_overrides?.lifecycle,
				batch: apiWorkerConfig?.lane_concurrency_overrides?.batch,
				crosspost: apiWorkerConfig?.lane_concurrency_overrides?.crosspost,
			},
		},
	};
}

interface APIServerOptions {
	port: number;
	headersTimeoutMs: number;
	requestTimeoutMs: number;
}

export function buildAPIServerOptions(config: APIConfig): APIServerOptions {
	return {
		port: config.port,
		headersTimeoutMs: config.headersTimeoutMs,
		requestTimeoutMs: config.requestTimeoutMs,
	};
}

let _config: APIConfig | null = null;

export function initializeConfig(config: APIConfig): void {
	if (_config !== null) {
		return;
	}
	_config = config;
}

export function getConfig(): APIConfig {
	if (_config === null) {
		throw new Error('Config has not been initialized. Call initializeConfig() first.');
	}
	return _config;
}

export const Config: APIConfig = new Proxy({} as APIConfig, {
	get(_target, prop: keyof APIConfig | symbol) {
		if (_config === null) {
			throw new Error('Config has not been initialized. Call initializeConfig() first.');
		}
		return _config[prop as keyof APIConfig];
	},
	set() {
		throw new Error('Cannot modify Config directly. Use initializeConfig() instead.');
	},
});
