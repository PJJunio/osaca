// SPDX-License-Identifier: AGPL-3.0-or-later

import {Endpoints} from '@app/features/app/constants/Endpoints';
import type {RuntimeConfigSnapshot} from '@app/features/app/state/InstanceSnapshotStore';
import {parseAccountRestriction} from '@app/features/auth/state/AccountRestriction';
import type {UserData} from '@app/features/auth/state/AccountStorageContract';
import Accounts from '@app/features/auth/state/Accounts';
import Authentication from '@app/features/auth/state/Authentication';
import {type InstanceHTTPTarget, instanceRequest} from '@app/features/platform/transport/InstanceHTTP';
import {HttpError} from '@app/features/platform/types/EndpointError';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {getCurrentOrDetectedLocale} from '@app/features/user/utils/LocaleUtils';
import type {
	AuthRegistrationPendingApprovalResponse,
	DesktopHandoffReturnMethod,
	RegisterRequest,
	UsernameAvailabilityResponse,
	UsernameSuggestionsResponse,
} from '@osaca/schema/src/domains/auth/AuthSchemas';
import type {GuildEntryResult} from '@osaca/schema/src/domains/user/AccountSchemas';
import type {UserPartial} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import type {AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser';

const logger = new Logger('AuthService');
const withAuthLocaleHeader = (headers?: Record<string, string>): Record<string, string> => ({
	'Accept-Language': getCurrentOrDetectedLocale(),
	...(headers ?? {}),
});

function isRouteUnimplemented(error: unknown): boolean {
	return error instanceof HttpError && (error.status === 404 || error.status === 405);
}

export type AuthResponseUser = UserPartial;

export interface AuthTokenResponse {
	user_id: string;
	token: string;
	theme?: string;
	redirect_to?: string;
	user?: AuthResponseUser | null;
}

interface StandardLoginResponse extends AuthTokenResponse {
	mfa?: false;
}

export interface MfaLoginResponse {
	mfa: true;
	ticket: string;
	totp: boolean;
	webauthn: boolean;
	backup_codes?: boolean;
	allowed_methods?: Array<string>;
}

type LoginResponse = StandardLoginResponse | MfaLoginResponse;

export type AuthResponseUserIdentity = Pick<AuthResponseUser, 'username' | 'discriminator' | 'global_name' | 'avatar'>;

export function authResponseUserToUserData(user?: AuthResponseUserIdentity | null): UserData | undefined {
	if (!user) {
		return undefined;
	}
	const userData: UserData = {
		username: user.username,
		discriminator: user.discriminator,
		globalName: user.global_name,
		avatar: user.avatar,
	};
	return userData;
}

export type TokenResponse = AuthTokenResponse;
export type RegistrationPendingApprovalResponse = AuthRegistrationPendingApprovalResponse;
export type RegisterResponse =
	| (TokenResponse & {entry?: GuildEntryResult | null})
	| RegistrationPendingApprovalResponse;

export function isRegistrationPendingApprovalResponse(
	response: RegisterResponse,
): response is RegistrationPendingApprovalResponse {
	return 'registration_pending_approval' in response && response.registration_pending_approval === true;
}

export type ResetPasswordResponse = AuthTokenResponse | MfaLoginResponse;

interface RecoveryKitIssued {
	recovery_key: string;
	recovery_kit_created_at: string;
}

export type RecoverAccountResponse = (AuthTokenResponse | MfaLoginResponse) & RecoveryKitIssued;

interface DesktopHandoffInitiateResponse {
	code: string;
	expires_at: string;
	poll_secret?: string;
	return_method?: DesktopHandoffReturnMethod;
}

interface DesktopHandoffStatusResponse {
	status: 'pending' | 'completed' | 'denied' | 'expired';
	token?: string;
	user_id?: string;
	user?: AuthResponseUser | null;
}

interface DesktopHandoffInfoClientInfo {
	platform?: string | null;
	os?: string | null;
	device?: 'mobile' | 'desktop';
	location?: {
		city?: string | null;
		region?: string | null;
		country?: string | null;
	} | null;
}

export interface DesktopHandoffInfoResponse {
	status: 'pending' | 'expired';
	client_info?: DesktopHandoffInfoClientInfo | null;
	return_method?: DesktopHandoffReturnMethod;
}

interface DesktopHandoffCompleteResponse {
	return_url?: string;
}

type LoginParams = {
	login: string;
	password: string;
	inviteCode?: string;
	target: InstanceHTTPTarget;
};

interface MfaCodeLoginRequest {
	code: string;
	ticket: string;
	inviteCode?: string;
	target: InstanceHTTPTarget;
}

interface MfaWebAuthnLoginRequest {
	response: AuthenticationResponseJSON;
	challenge: string;
	ticket: string;
	inviteCode?: string;
	target: InstanceHTTPTarget;
}

interface MfaWebAuthnOptionsRequest {
	ticket: string;
	target: InstanceHTTPTarget;
}

interface WebAuthnOptionsRequest {
	target: InstanceHTTPTarget;
}

interface WebAuthnLoginRequest {
	response: AuthenticationResponseJSON;
	challenge: string;
	inviteCode?: string;
	target: InstanceHTTPTarget;
}

function withInviteCode<T extends object>(body: T, inviteCode?: string): T & {invite_code?: string} {
	return inviteCode ? {...body, invite_code: inviteCode} : body;
}

function loginBody(params: LoginParams): {
	login: string;
	password: string;
	invite_code?: string;
} {
	return withInviteCode({login: params.login, password: params.password}, params.inviteCode);
}

function mfaTotpBody(
	code: string,
	ticket: string,
	inviteCode?: string,
): {code: string; ticket: string; invite_code?: string} {
	return withInviteCode({code, ticket}, inviteCode);
}

function mfaWebAuthnBody(
	response: AuthenticationResponseJSON,
	challenge: string,
	ticket: string,
	inviteCode?: string,
): {response: AuthenticationResponseJSON; challenge: string; ticket: string; invite_code?: string} {
	return withInviteCode({response, challenge, ticket}, inviteCode);
}

function webAuthnBody(
	response: AuthenticationResponseJSON,
	challenge: string,
	inviteCode?: string,
): {response: AuthenticationResponseJSON; challenge: string; invite_code?: string} {
	return withInviteCode({response, challenge}, inviteCode);
}

function ticketBody(ticket: string): {ticket: string} {
	return {ticket};
}

function tokenBody(token: string): {token: string} {
	return {token};
}

export async function login(params: LoginParams): Promise<LoginResponse> {
	try {
		const response = await instanceRequest<LoginResponse>({
			method: 'POST',
			path: Endpoints.AUTH_LOGIN,
			target: params.target,
			body: loginBody(params),
			headers: withAuthLocaleHeader(),
		});
		logger.debug('Login successful', {mfa: response.body?.mfa});
		return response.body;
	} catch (error) {
		logger.error('Login failed', error);
		throw error;
	}
}

export async function loginMfaTotp({code, ticket, inviteCode, target}: MfaCodeLoginRequest): Promise<TokenResponse> {
	try {
		const response = await instanceRequest<TokenResponse>({
			method: 'POST',
			path: Endpoints.AUTH_LOGIN_MFA_TOTP,
			target,
			body: mfaTotpBody(code, ticket, inviteCode),
			headers: withAuthLocaleHeader(),
		});
		const responseBody = response.body;
		logger.debug('MFA TOTP authentication successful');
		return responseBody;
	} catch (error) {
		logger.error('MFA TOTP authentication failed', error);
		throw error;
	}
}

export async function loginMfaWebAuthn({
	response,
	challenge,
	ticket,
	inviteCode,
	target,
}: MfaWebAuthnLoginRequest): Promise<TokenResponse> {
	try {
		const httpResponse = await instanceRequest<TokenResponse>({
			method: 'POST',
			path: Endpoints.AUTH_LOGIN_MFA_WEBAUTHN,
			target,
			body: mfaWebAuthnBody(response, challenge, ticket, inviteCode),
			headers: withAuthLocaleHeader(),
		});
		const responseBody = httpResponse.body;
		logger.debug('MFA WebAuthn authentication successful');
		return responseBody;
	} catch (error) {
		logger.error('MFA WebAuthn authentication failed', error);
		throw error;
	}
}

export async function getWebAuthnMfaOptions({
	ticket,
	target,
}: MfaWebAuthnOptionsRequest): Promise<PublicKeyCredentialRequestOptionsJSON> {
	try {
		const response = await instanceRequest<PublicKeyCredentialRequestOptionsJSON>({
			method: 'POST',
			path: Endpoints.AUTH_LOGIN_MFA_WEBAUTHN_OPTIONS,
			target,
			body: ticketBody(ticket),
			headers: withAuthLocaleHeader(),
		});
		const responseBody = response.body;
		logger.debug('WebAuthn MFA options retrieved');
		return responseBody;
	} catch (error) {
		logger.error('Failed to get WebAuthn MFA options', error);
		throw error;
	}
}

export async function getWebAuthnAuthenticationOptions({
	target,
}: WebAuthnOptionsRequest): Promise<PublicKeyCredentialRequestOptionsJSON> {
	try {
		const response = await instanceRequest<PublicKeyCredentialRequestOptionsJSON>({
			method: 'POST',
			path: Endpoints.AUTH_WEBAUTHN_OPTIONS,
			target,
			headers: withAuthLocaleHeader(),
		});
		const responseBody = response.body;
		logger.debug('WebAuthn authentication options retrieved');
		return responseBody;
	} catch (error) {
		logger.error('Failed to get WebAuthn authentication options', error);
		throw error;
	}
}

export async function authenticateWithWebAuthn({
	response,
	challenge,
	inviteCode,
	target,
}: WebAuthnLoginRequest): Promise<TokenResponse> {
	try {
		const httpResponse = await instanceRequest<TokenResponse>({
			method: 'POST',
			path: Endpoints.AUTH_WEBAUTHN_AUTHENTICATE,
			target,
			body: webAuthnBody(response, challenge, inviteCode),
			headers: withAuthLocaleHeader(),
		});
		const responseBody = httpResponse.body;
		logger.debug('WebAuthn authentication successful');
		return responseBody;
	} catch (error) {
		logger.error('WebAuthn authentication failed', error);
		throw error;
	}
}

export async function register(data: RegisterRequest, target: InstanceHTTPTarget): Promise<RegisterResponse> {
	try {
		const response = await instanceRequest<RegisterResponse>({
			method: 'POST',
			path: Endpoints.AUTH_REGISTER,
			target: target,
			body: data,
			headers: withAuthLocaleHeader(),
		});
		const responseBody = response.body;
		logger.info('Registration successful');
		return responseBody;
	} catch (error) {
		logger.error('Registration failed', error);
		throw error;
	}
}

export async function getUsernameSuggestions(globalName: string, target: InstanceHTTPTarget): Promise<Array<string>> {
	try {
		const response = await instanceRequest<UsernameSuggestionsResponse>({
			method: 'POST',
			path: Endpoints.AUTH_USERNAME_SUGGESTIONS,
			target,
			body: {global_name: globalName},
			headers: withAuthLocaleHeader(),
		});
		const responseBody = response.body;
		logger.debug('Username suggestions retrieved', {count: responseBody?.suggestions?.length || 0});
		return responseBody?.suggestions ?? [];
	} catch (error) {
		logger.error('Failed to fetch username suggestions', error);
		throw error;
	}
}

export async function checkUsernameAvailability(
	username: string,
	target: InstanceHTTPTarget,
	signal?: AbortSignal,
): Promise<boolean> {
	const response = await instanceRequest<UsernameAvailabilityResponse>({
		method: 'GET',
		path: `${Endpoints.AUTH_USERNAME_AVAILABILITY}?${new URLSearchParams({username}).toString()}`,
		target,
		headers: withAuthLocaleHeader(),
		signal,
	});
	return response.body.available;
}

export async function validateResetPasswordToken(token: string, target: InstanceHTTPTarget): Promise<boolean> {
	try {
		const response = await instanceRequest<{valid: boolean}>({
			method: 'GET',
			path: Endpoints.AUTH_VALIDATE_RESET_PASSWORD_TOKEN(token),
			target: target,
			headers: withAuthLocaleHeader(),
		});
		return response.body.valid;
	} catch (error) {
		logger.error('Password reset token validation failed', error);
		throw error;
	}
}

export async function resetPassword(
	token: string,
	password: string,
	target: InstanceHTTPTarget,
): Promise<ResetPasswordResponse> {
	try {
		const response = await instanceRequest<ResetPasswordResponse>({
			method: 'POST',
			path: Endpoints.AUTH_RESET_PASSWORD,
			target: target,
			body: {token, password},
			headers: withAuthLocaleHeader(),
		});
		const responseBody = response.body;
		logger.info('Password reset successful');
		return responseBody;
	} catch (error) {
		logger.error('Password reset failed', error);
		throw error;
	}
}

export async function recoverAccount({
	login,
	recoveryKey,
	password,
	target,
}: {
	login: string;
	recoveryKey: string;
	password: string;
	target: InstanceHTTPTarget;
}): Promise<RecoverAccountResponse> {
	try {
		const response = await instanceRequest<RecoverAccountResponse>({
			method: 'POST',
			path: Endpoints.AUTH_RECOVER,
			target: target,
			body: {login, recovery_key: recoveryKey, password},
			headers: withAuthLocaleHeader(),
		});
		logger.info('Account recovery successful');
		return response.body;
	} catch (error) {
		logger.error('Account recovery failed', error);
		throw error;
	}
}

export async function logout(options: {notifyServer?: boolean} = {}): Promise<void> {
	await Accounts.logout(options);
}

export async function redeemSignInLink(token: string, target: InstanceHTTPTarget): Promise<AuthTokenResponse> {
	const response = await instanceRequest<AuthTokenResponse>({
		method: 'POST',
		path: Endpoints.AUTH_SIGN_IN_LINK,
		target,
		body: tokenBody(token),
		headers: withAuthLocaleHeader(),
	});
	return response.body;
}

export async function initiateDesktopHandoff(target: InstanceHTTPTarget): Promise<DesktopHandoffInitiateResponse> {
	const response = await instanceRequest<DesktopHandoffInitiateResponse>({
		method: 'POST',
		path: Endpoints.AUTH_HANDOFF_INITIATE,
		target,
		auth: 'none',
	});
	return response.body;
}

async function readDesktopHandoffStatus(
	code: string,
	target: InstanceHTTPTarget,
): Promise<DesktopHandoffStatusResponse> {
	const response = await instanceRequest<DesktopHandoffStatusResponse>({
		method: 'GET',
		path: Endpoints.AUTH_HANDOFF_STATUS(code),
		target,
		auth: 'none',
	});
	return response.body;
}

export async function pollDesktopHandoffStatus(
	code: string,
	pollSecret: string | null | undefined,
	target: InstanceHTTPTarget,
): Promise<DesktopHandoffStatusResponse> {
	if (pollSecret == null || pollSecret.length === 0) {
		return readDesktopHandoffStatus(code, target);
	}
	try {
		const response = await instanceRequest<DesktopHandoffStatusResponse>({
			method: 'POST',
			path: Endpoints.AUTH_HANDOFF_STATUS(code),
			target,
			body: {poll_secret: pollSecret},
			auth: 'none',
		});
		return response.body;
	} catch (error) {
		if (!isRouteUnimplemented(error)) {
			throw error;
		}
		return readDesktopHandoffStatus(code, target);
	}
}

export async function completeDesktopHandoff({
	code,
	token,
	userId,
	returnMethod,
	target,
}: {
	code: string;
	token: string;
	userId: string;
	returnMethod: DesktopHandoffReturnMethod;
	target: InstanceHTTPTarget;
}): Promise<string | null> {
	const response = await instanceRequest<DesktopHandoffCompleteResponse | null>({
		method: 'POST',
		path: Endpoints.AUTH_HANDOFF_COMPLETE,
		target,
		body: {code, user_id: userId, return_method: returnMethod},
		headers: withAuthLocaleHeader({Authorization: token}),
		auth: 'none',
	});
	return response.body?.return_url ?? null;
}

export async function denyDesktopHandoff({code, target}: {code: string; target: InstanceHTTPTarget}): Promise<void> {
	await instanceRequest({
		method: 'POST',
		path: Endpoints.AUTH_HANDOFF_DENY(code),
		target,
		headers: withAuthLocaleHeader(),
		auth: 'none',
	});
}

export async function fetchDesktopHandoffInfo({
	code,
	token,
	target,
}: {
	code: string;
	token: string;
	target: InstanceHTTPTarget;
}): Promise<DesktopHandoffInfoResponse> {
	const response = await instanceRequest<DesktopHandoffInfoResponse>({
		method: 'GET',
		path: Endpoints.AUTH_HANDOFF_INFO(code),
		target,
		headers: withAuthLocaleHeader({Authorization: token}),
		auth: 'none',
	});
	return response.body;
}

interface CompleteLoginOptions {
	redirectPath?: string | null;
}

interface CompleteLoginPayload {
	token: string;
	userId: string;
	userData?: UserData;
	runtimeSnapshot: RuntimeConfigSnapshot;
}

class InvalidLoginCredentialsError extends Error {
	constructor(field: 'token' | 'userId') {
		super(`Login response ${field} must be a non-empty string`);
		this.name = 'InvalidLoginCredentialsError';
	}
}

function requireLoginCredential(value: string, field: 'token' | 'userId'): string {
	if (value.trim().length === 0) {
		throw new InvalidLoginCredentialsError(field);
	}
	return value;
}

export async function completeLogin(
	{token, userId, userData, runtimeSnapshot}: CompleteLoginPayload,
	options: CompleteLoginOptions = {},
): Promise<void> {
	logger.info('Completing login process');
	await Accounts.switchToNewAccount({
		userId: requireLoginCredential(userId, 'userId'),
		token: requireLoginCredential(token, 'token'),
		userData,
		runtimeSnapshot,
		redirectPath: options.redirectPath,
	});
}

interface SetMfaTicketPayload {
	ticket: string;
	totp: boolean;
	webauthn: boolean;
	backupCodes: boolean;
	runtimeSnapshot: RuntimeConfigSnapshot;
}

export function setMfaTicket({ticket, totp, webauthn, backupCodes, runtimeSnapshot}: SetMfaTicketPayload): void {
	logger.debug('Setting MFA ticket');
	Authentication.handleMfaTicketSet({ticket, totp, webauthn, backupCodes, runtimeSnapshot});
}

export function clearMfaTicket(): void {
	logger.debug('Clearing MFA ticket');
	Authentication.handleMfaTicketClear();
}

export function showAccountRestriction(error: unknown): boolean {
	const restriction = parseAccountRestriction(error);
	if (restriction == null) {
		return false;
	}
	Authentication.handleAccountRestriction(restriction);
	return true;
}

export function clearAccountRestriction(): void {
	Authentication.handleAccountRestrictionClear();
}
