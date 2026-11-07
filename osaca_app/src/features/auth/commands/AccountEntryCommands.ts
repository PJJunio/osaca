// SPDX-License-Identifier: AGPL-3.0-or-later

import {Endpoints} from '@app/features/app/constants/Endpoints';
import type {RuntimeConfigSnapshot} from '@app/features/app/state/InstanceSnapshotStore';
import {
	type AuthTokenResponse,
	isRegistrationPendingApprovalResponse,
	type MfaLoginResponse,
	type RegistrationPendingApprovalResponse,
} from '@app/features/auth/commands/AuthenticationCommands';
import {type LoginSuccessPayload, type MfaChallenge, toLoginSuccessPayload} from '@app/features/auth/state/AuthFlow';
import {instanceRequest, instanceTargetFromSnapshot} from '@app/features/platform/transport/InstanceHTTP';
import {getCurrentOrDetectedLocale} from '@app/features/user/utils/LocaleUtils';
import type {GuildEntryResult} from '@osaca/schema/src/domains/user/AccountSchemas';

type EntryTokenResponse = AuthTokenResponse & {entry?: GuildEntryResult | null};

export type AccountEntryResult =
	| {type: 'success'; payload: LoginSuccessPayload; entry: GuildEntryResult | null}
	| {type: 'mfa'; challenge: MfaChallenge}
	| {type: 'pending_approval'};

function localeHeaders(): Record<string, string> {
	return {'Accept-Language': getCurrentOrDetectedLocale()};
}

function toEntryResult(
	response: EntryTokenResponse | MfaLoginResponse | RegistrationPendingApprovalResponse,
): AccountEntryResult {
	if ('mfa' in response && response.mfa === true) {
		return {
			type: 'mfa',
			challenge: {
				ticket: response.ticket,
				totp: response.totp,
				webauthn: response.webauthn,
				backupCodes: response.backup_codes ?? false,
			},
		};
	}
	if (isRegistrationPendingApprovalResponse(response as RegistrationPendingApprovalResponse)) {
		return {type: 'pending_approval'};
	}
	const tokenResponse = response as EntryTokenResponse;
	return {type: 'success', payload: toLoginSuccessPayload(tokenResponse), entry: tokenResponse.entry ?? null};
}

interface InstantAccountRequest {
	readonly globalName: string;
	readonly consent: boolean;
	readonly inviteCode: string | null;
	readonly registrationUrlCode: string | null;
	readonly snapshot: RuntimeConfigSnapshot;
}

export async function createInstantAccount({
	globalName,
	consent,
	inviteCode,
	registrationUrlCode,
	snapshot,
}: InstantAccountRequest): Promise<AccountEntryResult> {
	const response = await instanceRequest<EntryTokenResponse | RegistrationPendingApprovalResponse>({
		method: 'POST',
		path: Endpoints.AUTH_REGISTER,
		target: instanceTargetFromSnapshot(snapshot),
		body: {
			...(globalName === '' ? {} : {global_name: globalName}),
			consent,
			...(inviteCode === null ? {} : {invite_code: inviteCode}),
			...(registrationUrlCode === null ? {} : {registration_url_code: registrationUrlCode}),
		},
		headers: localeHeaders(),
	});
	return toEntryResult(response.body);
}

interface RedeemAccountHandoffRequest {
	readonly handoffCode: string;
	readonly nonce: string;
	readonly consent: boolean;
	readonly globalName: string;
	readonly snapshot: RuntimeConfigSnapshot;
}

export async function redeemAccountHandoff({
	handoffCode,
	nonce,
	consent,
	globalName,
	snapshot,
}: RedeemAccountHandoffRequest): Promise<{payload: LoginSuccessPayload; entry: GuildEntryResult | null}> {
	const response = await instanceRequest<EntryTokenResponse>({
		method: 'POST',
		path: Endpoints.AUTH_ACCOUNT_HANDOFF_REDEEM,
		target: instanceTargetFromSnapshot(snapshot),
		body: {
			handoff_code: handoffCode,
			nonce,
			consent,
			global_name: globalName,
		},
		headers: localeHeaders(),
		auth: 'none',
	});
	return {payload: toLoginSuccessPayload(response.body), entry: response.body.entry ?? null};
}
