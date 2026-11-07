// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MfaBackupCode, PasswordResetToken, UserID} from '@app/api/BrandedTypes';

export interface AuthSessionRow {
	user_id: UserID;
	session_id_hash: Buffer;
	created_at: Date;
	approx_last_used_at: Date;
	client_ip: string;
	client_user_agent: string | null;
	client_os: string | null;
	client_country: string | null;
	app_platform: string | null;
	app_version: string | null;
	app_release_channel: string | null;
	app_build_number: number | null;
	app_beta_number: number | null;
	auth_method: string | null;
	version: number;
}

export interface AuthSessionByAppChannelRow {
	app_platform: string;
	app_release_channel: string;
	session_id_hash: Buffer;
	user_id: UserID;
}

export interface AuthSessionTombstoneRow {
	user_id: UserID;
	session_id_hash: Buffer;
	created_at: Date;
	approx_last_used_at: Date;
	client_ip: string;
	client_user_agent: string | null;
	client_os: string | null;
	client_country: string | null;
	deleted_at: Date;
	version: number;
}

export interface MfaBackupCodeRow {
	user_id: UserID;
	code: MfaBackupCode;
	consumed: boolean;
}

export interface UserRecoveryKitRow {
	user_id: UserID;
	secret_hash: string;
	created_at: Date;
}

export interface PasswordResetTokenRow {
	token_: PasswordResetToken;
	user_id: UserID;
}

export interface AuthorizedIpRow {
	user_id: UserID;
	ip: string;
}

export interface AuthorizedIpTrustKeyRow {
	user_id: UserID;
	trust_key: string;
}

export interface WebAuthnCredentialRow {
	user_id: UserID;
	credential_id: string;
	public_key: Buffer;
	counter: bigint;
	transports: Set<string> | null;
	name: string;
	created_at: Date;
	last_used_at: Date | null;
	version: number;
	rp_id: string | null;
	superseded_by: string | null;
}

export const AUTH_SESSION_COLUMNS = [
	'user_id',
	'session_id_hash',
	'created_at',
	'approx_last_used_at',
	'client_ip',
	'client_user_agent',
	'client_os',
	'client_country',
	'app_platform',
	'app_version',
	'app_release_channel',
	'app_build_number',
	'app_beta_number',
	'auth_method',
	'version',
] as const satisfies ReadonlyArray<keyof AuthSessionRow>;
export const AUTH_SESSION_BY_APP_CHANNEL_COLUMNS = [
	'app_platform',
	'app_release_channel',
	'session_id_hash',
	'user_id',
] as const satisfies ReadonlyArray<keyof AuthSessionByAppChannelRow>;
export const AUTH_SESSION_TOMBSTONE_COLUMNS = [
	'user_id',
	'session_id_hash',
	'created_at',
	'approx_last_used_at',
	'client_ip',
	'client_user_agent',
	'client_os',
	'client_country',
	'deleted_at',
	'version',
] as const satisfies ReadonlyArray<keyof AuthSessionTombstoneRow>;
export const MFA_BACKUP_CODE_COLUMNS = ['user_id', 'code', 'consumed'] as const satisfies ReadonlyArray<
	keyof MfaBackupCodeRow
>;
export const USER_RECOVERY_KIT_COLUMNS = ['user_id', 'secret_hash', 'created_at'] as const satisfies ReadonlyArray<
	keyof UserRecoveryKitRow
>;
export const PASSWORD_RESET_TOKEN_COLUMNS = ['token_', 'user_id'] as const satisfies ReadonlyArray<
	keyof PasswordResetTokenRow
>;
export const AUTHORIZED_IP_COLUMNS = ['user_id', 'ip'] as const satisfies ReadonlyArray<keyof AuthorizedIpRow>;
export const AUTHORIZED_IP_TRUST_KEY_COLUMNS = ['user_id', 'trust_key'] as const satisfies ReadonlyArray<
	keyof AuthorizedIpTrustKeyRow
>;
export const WEBAUTHN_CREDENTIAL_COLUMNS = [
	'user_id',
	'credential_id',
	'public_key',
	'counter',
	'transports',
	'name',
	'created_at',
	'last_used_at',
	'version',
	'rp_id',
	'superseded_by',
] as const satisfies ReadonlyArray<keyof WebAuthnCredentialRow>;
