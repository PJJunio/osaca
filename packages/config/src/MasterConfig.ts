// SPDX-License-Identifier: AGPL-3.0-or-later

import type {DerivedEndpoints} from '@osaca/config/src/EndpointDerivation';

type RuntimeEnv = 'development' | 'production' | 'test';
type DatabaseBackend = 'postgres' | 'cassandra';
type PublicScheme = 'http' | 'https';
export const CACHE_PURGE_ADAPTER_NAMES = ['none', 'http', 'controller'] as const;
export type CachePurgeAdapterName = (typeof CACHE_PURGE_ADAPTER_NAMES)[number];

export interface VoiceTurnServerConfig {
	host: string;
	port: number;
	protocol: 'udp' | 'tcp' | 'tls';
	username?: string;
	credential?: string;
	secret?: string;
	ttl?: number;
}

interface InstanceBrandingConfig {
	product_name: string;
	icon_url?: string;
	symbol_url?: string;
	logo_url?: string;
	wordmark_url?: string;
	favicon_url?: string;
	favicon_dark_url?: string;
	sign_in_backdrop_url?: string;
	theme_color?: string;
	status_page_url?: string;
	status_page_incident_history_url?: string;
}

export interface MasterConfig {
	env: RuntimeEnv;
	domain: {
		base_domain: string;
		public_origin: string;
		public_scheme: PublicScheme;
		public_port: number;
		static_cdn_domain: string;
		invite_domain: string;
		gift_domain: string;
	};
	endpoint_overrides?: Partial<DerivedEndpoints>;
	endpoints: DerivedEndpoints;
	internal: {
		kv: string;
		kv_mode: 'standalone' | 'cluster';
		media_proxy: string;
	};
	database: {
		backend: DatabaseBackend;
		cassandra: {
			hosts: Array<string>;
			port: number;
			keyspace: string;
			local_dc: string;
			username: string;
			password: string;
		};
		postgres: {
			url: string;
			host: string;
			port: number;
			database: string;
			username: string;
			password: string;
			ssl: boolean;
			ssl_ca: string;
			max_connections: number;
			kv_table: string;
			prepared_statements: boolean;
		};
	};
	s3?: {
		endpoint: string;
		presigned_url_base?: string;
		force_path_style: boolean;
		region: string;
		access_key_id: string;
		secret_access_key: string;
		buckets: {
			cdn: string;
			uploads: string;
			reports: string;
			harvests: string;
		};
	};
	services: {
		api: {
			port: number;
			headers_timeout_ms: number;
			request_timeout_ms: number;
			max_inflight_requests: number;
			automated_message_deletion_delay_days: number;
			ip_ban_exempt_ips: Array<string>;
			trusted_callers: Array<{
				name: string;
				key: string;
				buckets: Array<string>;
			}>;
			presigned_attachment_uploads_enabled: boolean;
			presigned_harvest_downloads_enabled: boolean;
			unfurl_ignored_hosts: Array<string>;
			app_origin_aliases: Array<string>;
			discovery_public_endpoint: string;
			discovery_transport_endpoint: string;
			worker?: {
				mode?: 'all_lanes' | 'single_lane' | 'single_task';
				lane?: 'realtime' | 'unfurl' | 'lifecycle' | 'batch' | 'crosspost';
				task?: string;
				enable_cron_scheduler?: boolean;
				metrics_port?: number;
				embedded?: boolean;
				lane_concurrency_overrides?: {
					realtime?: number;
					unfurl?: number;
					lifecycle?: number;
					batch?: number;
					crosspost?: number;
				};
			};
			storage_change_feed?: {
				enabled?: boolean;
				stream?: string;
				skip_buckets?: Array<string>;
			};
		};
		nats?: {
			core_url?: string;
			jetstream_url?: string;
			auth_token?: string;
		};
		media_proxy: {
			secret_key: string;
			upload_relay: {
				endpoint: string;
				secret_base64: string;
				max_body_bytes: number;
				token_ttl_secs: number;
			};
			attachment_urls: {
				secrets_base64: Array<string>;
			};
		};
		gateway: {
			rpc_auth_token?: string;
		};
		admin: {
			secret_key_base: string;
			oauth_client_secret: string;
		};
	};
	auth: {
		sudo_mode_secret: string;
		connection_initiation_secret: string;
		profile_pseudonym_secret: string;
		passkeys: {
			rp_name: string;
			rp_id: string;
			additional_allowed_origins: Array<string>;
		};
		vapid: {
			public_key: string;
			private_key: string;
			email: string;
		};
		bluesky: {
			enabled: boolean;
			client_name: string;
			client_uri: string;
			logo_uri: string;
			tos_uri: string;
			policy_uri: string;
			keys: Array<{
				kid: string;
				private_key?: string;
				private_key_path?: string;
			}>;
		};
	};
	integrations: {
		voice: {
			enabled: boolean;
			api_key: string;
			api_secret: string;
			url: string;
			internal_url: string;
			bundled?: boolean;
			default_region?: {
				id: string;
				name: string;
				emoji: string;
				latitude: number;
				longitude: number;
			};
			p2p_stun_urls?: Array<string>;
			turn_servers?: Array<VoiceTurnServerConfig>;
			join_allow_private_endpoints?: boolean;
			health_interval_ms?: number;
		};
		search: {
			engine: 'elasticsearch' | 'meilisearch' | 'none';
			url: string;
			api_key: string;
			username: string;
			password: string;
			tls_reject_unauthorized: boolean;
		};
		clamav: {
			enabled: boolean;
			host: string;
			port: number;
			fail_open: boolean;
		};
		youtube: {
			api_key: string;
		};
		cache_purge: {
			adapter: CachePurgeAdapterName;
			http: {
				endpoint: string;
				token: string;
				timeout_ms: number;
			};
			controller: {
				endpoint: string;
				token: string;
				timeout_ms: number;
			};
		};
		blocklist_feeds: {
			enabled?: boolean;
		};
		breached_password_check: {
			enabled?: boolean;
		};
	};
	instance: {
		self_hosted: boolean;
		auto_join_invite_code?: string;
		branding: InstanceBrandingConfig;
		setup: {
			configured: boolean;
			token?: string;
		};
	};
	dev: {
		relax_registration_rate_limits: boolean;
		disable_rate_limits: boolean;
		test_mode_enabled: boolean;
		test_harness_token?: string;
		validate_responses?: boolean;
	};
	proxy: {
		trust_client_ip_header: boolean;
		client_ip_header: string;
	};
	discovery: {
		enabled: boolean;
		min_member_count: number;
	};
	attachment_decay_enabled: boolean;
	deletion_grace_period_hours: number;
	report_retention: {
		days: number;
		dry_run: boolean;
	};
}
