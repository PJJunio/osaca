// SPDX-License-Identifier: AGPL-3.0-or-later

import type {RouteRateLimitConfig} from '@app/api/middleware/RateLimitMiddleware';
import {ms} from 'itty-time';

export const AuthRateLimitConfigs = {
	AUTH_REGISTER: {
		bucket: 'auth:register',
		config: {limit: 10, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	AUTH_LOGIN: {
		bucket: 'auth:login',
		config: {limit: 10, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	AUTH_LOGIN_MFA: {
		bucket: 'auth:login:mfa',
		config: {limit: 5, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_RESET_PASSWORD: {
		bucket: 'auth:reset',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_RECOVER_ACCOUNT: {
		bucket: 'auth:recover',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_USERNAME_AVAILABILITY: {
		bucket: 'auth:username_availability',
		config: {limit: 30, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_REGISTER_HANDOFF: {
		bucket: 'auth:register:handoff',
		config: {limit: 10, windowMs: ms('10 seconds')},
		trustForwardedClientIp: true,
	} as RouteRateLimitConfig,
	AUTH_REGISTER_HANDOFF_CHALLENGE: {
		bucket: 'auth:register:handoff:challenge',
		config: {limit: 20, windowMs: ms('1 minute')},
		trustForwardedClientIp: true,
	} as RouteRateLimitConfig,
	AUTH_ACCOUNT_HANDOFF_REDEEM: {
		bucket: 'auth:register:handoff:redeem',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_VALIDATE_RESET_TOKEN: {
		bucket: 'auth:reset:validate',
		config: {limit: 20, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_SESSIONS_GET: {
		bucket: 'auth:sessions',
		config: {limit: 40, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	AUTH_SESSIONS_LOGOUT: {
		bucket: 'auth:sessions:logout',
		config: {limit: 20, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	AUTH_AUTHORIZE_IP: {
		bucket: 'auth:authorize_ip',
		config: {limit: 5, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_LOGOUT: {
		bucket: 'auth:logout',
		config: {limit: 20, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	AUTH_WEBAUTHN_OPTIONS: {
		bucket: 'auth:webauthn:options',
		config: {limit: 20, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	AUTH_WEBAUTHN_AUTHENTICATE: {
		bucket: 'auth:webauthn:authenticate',
		config: {limit: 10, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	MFA_WEBAUTHN_LIST: {
		bucket: 'mfa:webauthn:list',
		config: {limit: 40, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	MFA_WEBAUTHN_REGISTRATION_OPTIONS: {
		bucket: 'mfa:webauthn:registration_options',
		config: {limit: 20, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	MFA_WEBAUTHN_REGISTER: {
		bucket: 'mfa:webauthn:register',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	MFA_WEBAUTHN_UPDATE: {
		bucket: 'mfa:webauthn:update',
		config: {limit: 20, windowMs: ms('10 seconds')},
	} as RouteRateLimitConfig,
	MFA_WEBAUTHN_DELETE: {
		bucket: 'mfa:webauthn:delete',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	MFA_WEBAUTHN_TWO_FACTOR: {
		bucket: 'mfa:webauthn:two_factor',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	MFA_WEBAUTHN_MIGRATION: {
		bucket: 'mfa:webauthn:migration',
		config: {limit: 20, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_HANDOFF_INITIATE: {
		bucket: 'auth:handoff:initiate',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_HANDOFF_INFO: {
		bucket: 'auth:handoff:info',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_HANDOFF_COMPLETE: {
		bucket: 'auth:handoff:complete',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_HANDOFF_STATUS: {
		bucket: 'auth:handoff:status',
		config: {limit: 60, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_HANDOFF_DENY: {
		bucket: 'auth:handoff:deny',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_HANDOFF_CANCEL: {
		bucket: 'auth:handoff:cancel',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_ORIGIN_HANDOFF_CREATE: {
		bucket: 'auth:origin_handoff:create',
		config: {limit: 3, windowMs: ms('10 minutes')},
	} as RouteRateLimitConfig,
	AUTH_ORIGIN_HANDOFF_REDEEM: {
		bucket: 'auth:origin_handoff:redeem',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_PASSKEY_BRIDGE_START: {
		bucket: 'auth:passkey_bridge:start',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_PASSKEY_BRIDGE_CEREMONY: {
		bucket: 'auth:passkey_bridge:ceremony',
		config: {limit: 20, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	AUTH_PASSKEY_BRIDGE_REDEEM: {
		bucket: 'auth:passkey_bridge:redeem',
		config: {limit: 60, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	USER_PASSKEY_BRIDGE_START: {
		bucket: 'mfa:passkey_bridge:start',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	USER_PASSKEY_BRIDGE_REDEEM: {
		bucket: 'mfa:passkey_bridge:redeem',
		config: {limit: 60, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	SUDO_WEBAUTHN_OPTIONS: {
		bucket: 'sudo:webauthn:options',
		config: {limit: 10, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
	SUDO_MFA_METHODS: {
		bucket: 'sudo:mfa:methods',
		config: {limit: 20, windowMs: ms('1 minute')},
	} as RouteRateLimitConfig,
} as const;
