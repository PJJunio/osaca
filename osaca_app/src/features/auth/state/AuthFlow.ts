// SPDX-License-Identifier: AGPL-3.0-or-later

import type {RuntimeConfigSnapshot} from '@app/features/app/state/InstanceSnapshotStore';
import * as AuthenticationCommands from '@app/features/auth/commands/AuthenticationCommands';
import type {UserData} from '@app/features/auth/state/AccountStorageContract';
import {type InstanceHTTPTarget, instanceTargetFromSnapshot} from '@app/features/platform/transport/InstanceHTTP';
import type {AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser';

export interface LoginSuccessPayload {
	token: string;
	userId: string;
	userData?: UserData;
	redirect_to?: string;
}

export interface MfaChallenge {
	ticket: string;
	totp: boolean;
	webauthn: boolean;
	backupCodes: boolean;
}

export interface IpAuthorizationChallenge {
	ticket: string;
	email: string;
	resendAvailableIn: number;
}

export type LoginResult =
	| {type: 'success'; payload: LoginSuccessPayload}
	| {type: 'mfa'; challenge: MfaChallenge}
	| {type: 'ip_authorization'; challenge: IpAuthorizationChallenge};

function mfaChallengeFromResponse(response: AuthenticationCommands.MfaLoginResponse): MfaChallenge {
	return {
		ticket: response.ticket,
		totp: response.totp,
		webauthn: response.webauthn,
		backupCodes: response.backup_codes ?? false,
	};
}

export function toLoginSuccessPayload(response: AuthenticationCommands.AuthTokenResponse): LoginSuccessPayload {
	const userData = AuthenticationCommands.authResponseUserToUserData(response.user);
	return {
		token: response.token,
		userId: response.user_id,
		...(userData ? {userData} : {}),
	};
}

export async function loginWithPassword({
	runtimeSnapshot,
	...params
}: AuthenticationCommands.LoginIdentifier & {
	password: string;
	inviteCode?: string;
	runtimeSnapshot: RuntimeConfigSnapshot;
}): Promise<LoginResult> {
	const response = await AuthenticationCommands.login({
		...params,
		target: instanceTargetFromSnapshot(runtimeSnapshot),
	});
	if (AuthenticationCommands.isIpAuthorizationRequiredResponse(response)) {
		return {
			type: 'ip_authorization',
			challenge: {
				ticket: response.ticket,
				email: response.email,
				resendAvailableIn: response.resend_available_in ?? 30,
			},
		};
	}
	if (response.mfa) {
		return {
			type: 'mfa',
			challenge: mfaChallengeFromResponse(response),
		};
	}
	return {
		type: 'success',
		payload: toLoginSuccessPayload(response),
	};
}

export async function loginWithMfaCode({
	code,
	ticket,
	inviteCode,
	runtimeSnapshot,
}: {
	code: string;
	ticket: string;
	inviteCode?: string;
	runtimeSnapshot: RuntimeConfigSnapshot;
}): Promise<LoginSuccessPayload> {
	const response = await AuthenticationCommands.loginMfaTotp({
		code,
		ticket,
		inviteCode,
		target: instanceTargetFromSnapshot(runtimeSnapshot),
	});
	return toLoginSuccessPayload(response);
}

export async function getWebAuthnMfaOptions(
	ticket: string,
	runtimeSnapshot: RuntimeConfigSnapshot,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
	return AuthenticationCommands.getWebAuthnMfaOptions({ticket, target: instanceTargetFromSnapshot(runtimeSnapshot)});
}

export async function authenticateMfaWithWebAuthn({
	response,
	challenge,
	ticket,
	inviteCode,
	runtimeSnapshot,
}: {
	response: AuthenticationResponseJSON;
	challenge: string;
	ticket: string;
	inviteCode?: string;
	runtimeSnapshot: RuntimeConfigSnapshot;
}): Promise<LoginSuccessPayload> {
	const result = await AuthenticationCommands.loginMfaWebAuthn({
		response,
		challenge,
		ticket,
		inviteCode,
		target: instanceTargetFromSnapshot(runtimeSnapshot),
	});
	return toLoginSuccessPayload(result);
}

export async function getWebAuthnAuthenticationOptions(
	runtimeSnapshot: RuntimeConfigSnapshot,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
	return AuthenticationCommands.getWebAuthnAuthenticationOptions({target: instanceTargetFromSnapshot(runtimeSnapshot)});
}

export async function authenticateWithWebAuthn({
	response,
	challenge,
	inviteCode,
	runtimeSnapshot,
}: {
	response: AuthenticationResponseJSON;
	challenge: string;
	inviteCode?: string;
	runtimeSnapshot: RuntimeConfigSnapshot;
}): Promise<LoginSuccessPayload> {
	const result = await AuthenticationCommands.authenticateWithWebAuthn({
		response,
		challenge,
		inviteCode,
		target: instanceTargetFromSnapshot(runtimeSnapshot),
	});
	return toLoginSuccessPayload(result);
}

export type PasswordResetResult =
	| {type: 'success'; payload: LoginSuccessPayload}
	| {type: 'mfa'; challenge: MfaChallenge};

export async function resetPassword(
	token: string,
	password: string,
	target: InstanceHTTPTarget,
): Promise<PasswordResetResult> {
	const response = await AuthenticationCommands.resetPassword(token, password, target);
	if ('token' in response) {
		return {
			type: 'success',
			payload: toLoginSuccessPayload(response),
		};
	}
	return {
		type: 'mfa',
		challenge: mfaChallengeFromResponse(response),
	};
}

interface IssuedRecoveryKit {
	recoveryKey: string;
	createdAt: string;
}

export type AccountRecoveryResult = PasswordResetResult & {kit: IssuedRecoveryKit};

export async function recoverAccount({
	login,
	recoveryKey,
	password,
	runtimeSnapshot,
}: {
	login: string;
	recoveryKey: string;
	password: string;
	runtimeSnapshot: RuntimeConfigSnapshot;
}): Promise<AccountRecoveryResult> {
	const response = await AuthenticationCommands.recoverAccount({
		login,
		recoveryKey,
		password,
		target: instanceTargetFromSnapshot(runtimeSnapshot),
	});
	const kit = {recoveryKey: response.recovery_key, createdAt: response.recovery_kit_created_at};
	if ('token' in response) {
		return {type: 'success', payload: toLoginSuccessPayload(response), kit};
	}
	return {
		type: 'mfa',
		challenge: {
			ticket: response.ticket,
			totp: response.totp,
			webauthn: response.webauthn,
			backupCodes: response.backup_codes ?? false,
		},
		kit,
	};
}
