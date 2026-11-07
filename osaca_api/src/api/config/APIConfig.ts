// SPDX-License-Identifier: AGPL-3.0-or-later

import type {WorkerTaskName} from '@app/api/worker/WorkerLaneConfig';
import type {CachePurgeAdapterName, VoiceTurnServerConfig} from '@osaca/config/src/MasterConfig';

export type APIWorkerMode = 'all_lanes' | 'single_lane' | 'single_task';
export type APIWorkerLaneName = 'realtime' | 'unfurl' | 'lifecycle' | 'batch' | 'crosspost';

export interface TrustedCallerConfig {
	name: string;
	key: string;
	buckets: Array<string>;
}

interface APICachePurgeTarget {
	endpoint: string;
	token: string;
	timeoutMs: number;
}

export interface APICachePurgeConfig {
	adapter: CachePurgeAdapterName;
	http: APICachePurgeTarget;
	controller: APICachePurgeTarget;
}

export interface APIConfig {
	nodeEnv: 'development' | 'production';
	port: number;
	headersTimeoutMs: number;
	requestTimeoutMs: number;
	maxInflightRequests: number;
	automatedMessageDeletionDelayDays: number;
	ipBanExemptIps: Array<string>;
	postgres: {
		url: string;
		host: string;
		port: number;
		database: string;
		username: string;
		password: string;
		ssl: boolean;
		sslCa: string;
		maxConnections: number;
		kvTable: string;
		preparedStatements: boolean;
	};
	kv: {
		url: string;
		mode: 'standalone' | 'cluster';
	};
	nats: {
		coreUrl: string;
		jetStreamUrl: string;
		authToken: string;
	};
	storageChangeFeed: {
		enabled: boolean;
		stream: string;
		skipBuckets: Array<string>;
	};
	search: {
		engine: 'elasticsearch' | 'meilisearch' | 'none';
		url: string;
		apiKey: string;
		username: string;
		password: string;
		tlsRejectUnauthorized: boolean;
	};
	mediaProxy: {
		host: string;
		port: number;
		secretKey: string;
		uploadRelay: {
			endpoint: string;
			relaySecretBase64: string;
			maxBodyBytes: number;
			tokenTtlSecs: number;
		};
		attachmentUrls: {
			secretsBase64: Array<string>;
		};
	};
	proxy: {
		trust_client_ip_header: boolean;
		client_ip_header: string;
	};
	endpoints: {
		apiPublic: string;
		apiPublicDiscovery: string;
		apiTransportDiscovery: string | null;
		apiClient: string;
		webApp: string;
		webAppOrigins: Array<string>;
		gateway: string;
		media: string;
		staticCdn: string;
		marketing: string;
		admin: string;
		invite: string;
		gift: string;
	};
	internal: {
		gatewayRpcAuthToken: string;
		trustedCallers: Array<TrustedCallerConfig>;
	};
	hosts: {
		marketing: string;
		unfurlIgnored: Array<string>;
	};
	s3: {
		endpoint: string;
		presignedUrlBase: string | undefined;
		forcePathStyle: boolean;
		region: string;
		accessKeyId: string;
		secretAccessKey: string;
		buckets: {
			cdn: string;
			uploads: string;
			reports: string;
			harvests: string;
		};
	};
	blocklistFeeds: {
		enabled: boolean;
	};
	breachedPasswordCheck: {
		enabled: boolean;
	};
	voice: {
		enabled: boolean;
		apiKey?: string;
		apiSecret?: string;
		url?: string;
		internalUrl?: string;
		bundled: boolean;
		defaultRegion?: {
			id: string;
			name: string;
			emoji: string;
			latitude: number;
			longitude: number;
		};
		p2pStunUrls?: Array<string>;
		turnServers: Array<VoiceTurnServerConfig>;
		joinAllowPrivateEndpoints: boolean;
		healthIntervalMs: number;
	};
	cachePurge: APICachePurgeConfig;
	clamav: {
		enabled: boolean;
		host: string;
		port: number;
		failOpen: boolean;
	};
	admin: {
		oauthClientSecret?: string;
	};
	auth: {
		sudoModeSecret: string;
		connectionInitiationSecret: string;
		profilePseudonymSecret: string;
		passkeys: {
			rpName: string;
			rpId: string;
			allowedOrigins: Array<string>;
		};
		bluesky: BlueskyOAuthConfig;
	};
	youtube: {
		apiKey?: string;
	};
	instance: {
		selfHosted: boolean;
		baseDomain: string;
		autoJoinInviteCode?: string;
		branding: {
			productName: string;
			iconUrl?: string;
			symbolUrl?: string;
			logoUrl?: string;
			wordmarkUrl?: string;
			faviconUrl?: string;
			faviconDarkUrl?: string;
			signInBackdropUrl?: string;
			themeColor?: string;
			statusPageUrl?: string;
			statusPageIncidentHistoryUrl?: string;
		};
		setup: {
			configured: boolean;
			token: string | null;
		};
	};
	discovery: {
		enabled: boolean;
		minMemberCount: number;
	};
	dev: {
		relaxRegistrationRateLimits: boolean;
		disableRateLimits: boolean;
		testModeEnabled: boolean;
		testHarnessToken?: string;
		validateResponses: boolean;
	};
	presignedAttachmentUploadsEnabled: boolean;
	presignedHarvestDownloadsEnabled: boolean;
	attachmentDecayEnabled: boolean;
	deletionGracePeriodHours: number;
	reportRetention: {
		days: number;
		dryRun: boolean;
	};
	push: {
		publicVapidKey?: string;
	};
	worker: {
		mode: APIWorkerMode;
		laneName?: APIWorkerLaneName;
		taskName?: WorkerTaskName;
		enableCronScheduler?: boolean;
		metricsPort?: number;
		embedded: boolean;
		laneConcurrencyOverrides: {
			realtime?: number;
			unfurl?: number;
			lifecycle?: number;
			batch?: number;
			crosspost?: number;
		};
	};
}

export interface BlueskyOAuthKeyConfig {
	kid: string;
	private_key?: string;
	private_key_path?: string;
}

export interface BlueskyOAuthConfig {
	enabled: boolean;
	client_name: string;
	client_uri: string;
	logo_uri: string;
	tos_uri: string;
	policy_uri: string;
	keys: Array<BlueskyOAuthKeyConfig>;
}
