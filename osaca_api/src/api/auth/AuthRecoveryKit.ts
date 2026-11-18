// SPDX-License-Identifier: AGPL-3.0-or-later

import crypto from 'node:crypto';
import type {ApiContext} from '@app/api/ApiContext';
import {shouldEnforceAccountBudgets} from '@app/api/auth/AccountBudgets';
import {createMfaTicketResponse} from '@app/api/auth/AuthLogin';
import * as AuthPassword from '@app/api/auth/AuthPassword';
import * as AuthUtility from '@app/api/auth/AuthUtility';
import {RecoveryKitRepository} from '@app/api/auth/services/RecoveryKitRepository';
import {resolveWebAuthnSecondFactor} from '@app/api/auth/services/WebAuthnSecondFactor';
import {recordUsernameFailure, usernameKey} from '@app/api/auth/UsernameFailures';
import {createUserID, type UserID} from '@app/api/BrandedTypes';
import type {UserRecoveryKitRow} from '@app/api/database/types/AuthTypes';
import {
	REGISTRATION_PENDING_APPROVAL_TRAIT,
	REGISTRATION_REJECTED_TRAIT,
} from '@app/api/instance/InstanceConfigRepository';
import {Logger} from '@app/api/Logger';
import type {User} from '@app/api/models/User';
import {findPersonByLoginHandle, parseLoginHandle} from '@app/api/user/UniqueUsernames';
import {hashPassword} from '@app/api/utils/PasswordUtils';
import {createRateLimitError} from '@app/api/utils/RateLimitUtils';
import {secretMatchesHash, sha256Hex} from '@app/api/utils/SecretHash';
import {
	generateRecoveryKey,
	normalizeRecoveryKey,
	RECOVERY_KEY_BYTE_LENGTH,
} from '@osaca/constants/src/RecoveryKeyUtils';
import {UserAuthenticatorTypes} from '@osaca/constants/src/UserConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {RegistrationPendingApprovalError} from '@osaca/errors/src/domains/auth/RegistrationPendingApprovalError';
import {RegistrationRejectedError} from '@osaca/errors/src/domains/auth/RegistrationRejectedError';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import type {RecoverAccountRequest} from '@osaca/schema/src/domains/auth/AuthSchemas';
import type {
	RecoveryKitCreateResponse,
	RecoveryKitStatusResponse,
} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {ms, seconds} from 'itty-time';

const DUMMY_SECRET_HASH = sha256Hex('osaca-recovery-kit-dummy');

const recoveryKits = new RecoveryKitRepository();
const DUMMY_KIT_USER_ID = createUserID(0n);

interface RecoverAccountParams {
	data: RecoverAccountRequest;
	request: Request;
	captchaVerified?: boolean;
}

interface PendingRecovery {
	userId: string;
	expectedSecretHash: string;
	secretHash: string;
	createdAt: string;
	passwordHash: string;
}

export interface RecoverAccountResult {
	result: Awaited<ReturnType<typeof AuthPassword.applyPasswordReset>>;
	recoveryKey: string;
	createdAt: Date;
}

function issueRecoveryKey(): {formatted: string; secretHash: string; createdAt: Date} {
	const {key, formatted} = generateRecoveryKey(new Uint8Array(crypto.randomBytes(RECOVERY_KEY_BYTE_LENGTH)));
	return {formatted, secretHash: sha256Hex(key), createdAt: new Date()};
}

function pendingRecoveryKey(ticket: string): string {
	return `mfa-recovery:${ticket}`;
}

async function restoreRecoveryKit(userId: UserID, issuedSecretHash: string, kit: UserRecoveryKitRow): Promise<void> {
	try {
		await recoveryKits.replaceIfUnchanged({
			userId,
			expectedSecretHash: issuedSecretHash,
			secretHash: kit.secret_hash,
			createdAt: kit.created_at,
		});
	} catch (error) {
		Logger.error({error, userId: userId.toString()}, 'Could not restore the recovery kit after a failed recovery');
	}
}

function invalidRecoveryKeyError(): InputValidationError {
	return InputValidationError.fromCode('recovery_key', ValidationErrorCodes.INVALID_RECOVERY_KEY);
}

// Wrong recovery keys for one username, never per address (ADR-0017). With a solved captcha the cost of trying again
// grows with them instead, so the lockout only applies while the captcha is off: it would also lock the owner out.
function recoverLockout(login: string) {
	const username = usernameKey(login);
	return username === null ? null : {identifier: `recover:id:${username}`, maxAttempts: 5, windowMs: ms('30 minutes')};
}

async function assertRecoverNotLockedOut(ctx: ApiContext, params: RecoverAccountParams): Promise<void> {
	const lockout = recoverLockout(params.data.login);
	if (lockout === null || params.captchaVerified || !shouldEnforceAccountBudgets(params.request)) return;
	const state = await ctx.services.rateLimit.peekLimit(lockout);
	if (!state.allowed) throw createRateLimitError(state);
}

async function recordWrongRecoveryKey(ctx: ApiContext, login: string): Promise<never> {
	const lockout = recoverLockout(login);
	if (lockout !== null) await ctx.services.rateLimit.checkLimit(lockout);
	await recordUsernameFailure(ctx.services.kv, 'recover', login);
	throw invalidRecoveryKeyError();
}

export async function getRecoveryKitStatus(userId: UserID): Promise<RecoveryKitStatusResponse> {
	const kit = await recoveryKits.find(userId);
	return {
		has_recovery_kit: kit !== null,
		created_at: kit ? kit.created_at.toISOString() : null,
	};
}

export async function createRecoveryKit(userId: UserID): Promise<RecoveryKitCreateResponse> {
	const issued = issueRecoveryKey();
	await recoveryKits.upsert({user_id: userId, secret_hash: issued.secretHash, created_at: issued.createdAt});
	return {recovery_key: issued.formatted, created_at: issued.createdAt.toISOString()};
}

export async function deleteRecoveryKit(userId: UserID): Promise<void> {
	await recoveryKits.delete(userId);
}

export async function findRecoveryKitCreatedAt(userId: UserID): Promise<Date | null> {
	return (await recoveryKits.find(userId))?.created_at ?? null;
}

export async function recoverAccount(ctx: ApiContext, params: RecoverAccountParams): Promise<RecoverAccountResult> {
	const {data, request} = params;
	const handle = parseLoginHandle(data.login);
	await assertRecoverNotLockedOut(ctx, params);
	const normalizedKey = normalizeRecoveryKey(data.recovery_key);
	const user = handle ? await findPersonByLoginHandle(ctx.services.users, handle) : null;
	const kit = await recoveryKits.find(user ? user.id : DUMMY_KIT_USER_ID);
	const keyMatches = secretMatchesHash(normalizedKey ?? data.recovery_key, kit?.secret_hash ?? DUMMY_SECRET_HASH);
	if (!user || !kit || normalizedKey === null || !keyMatches) {
		return await recordWrongRecoveryKey(ctx, data.login);
	}
	const currentUser = await AuthUtility.assertSignInAllowed(ctx, user);
	if (currentUser.traits.has(REGISTRATION_PENDING_APPROVAL_TRAIT)) {
		throw new RegistrationPendingApprovalError();
	}
	if (currentUser.traits.has(REGISTRATION_REJECTED_TRAIT)) {
		throw new RegistrationRejectedError();
	}
	if (await AuthPassword.isPasswordPwned(ctx, data.password)) {
		throw InputValidationError.fromCode('password', ValidationErrorCodes.PASSWORD_IS_TOO_COMMON);
	}
	const issued = issueRecoveryKey();
	const webauthnIsSecondFactor = await resolveWebAuthnSecondFactor(ctx, currentUser);
	if (currentUser.authenticatorTypes.has(UserAuthenticatorTypes.TOTP) || webauthnIsSecondFactor) {
		const pending: PendingRecovery = {
			userId: currentUser.id.toString(),
			expectedSecretHash: kit.secret_hash,
			secretHash: issued.secretHash,
			createdAt: issued.createdAt.toISOString(),
			passwordHash: await hashPassword(data.password),
		};
		const challenge = await createMfaTicketResponse(ctx, currentUser, webauthnIsSecondFactor);
		try {
			await ctx.services.cache.set<PendingRecovery>(
				pendingRecoveryKey(challenge.ticket),
				pending,
				seconds('5 minutes'),
			);
		} catch (error) {
			await ctx.services.cache.delete(`mfa-ticket:${challenge.ticket}`);
			throw error;
		}
		return {result: challenge, recoveryKey: issued.formatted, createdAt: issued.createdAt};
	}
	const rotated = await recoveryKits.replaceIfUnchanged({
		userId: currentUser.id,
		expectedSecretHash: kit.secret_hash,
		secretHash: issued.secretHash,
		createdAt: issued.createdAt,
	});
	if (!rotated) {
		throw invalidRecoveryKeyError();
	}
	let result: RecoverAccountResult['result'];
	try {
		result = await AuthPassword.applyPasswordReset(ctx, {
			user: currentUser,
			password: data.password,
			request,
			afterPasswordSet: () => ctx.services.users.deleteAllPasswordResetTokens(currentUser.id),
		});
	} catch (error) {
		await restoreRecoveryKit(currentUser.id, issued.secretHash, kit);
		throw error;
	}
	return {result, recoveryKey: issued.formatted, createdAt: issued.createdAt};
}

export async function applyPendingRecovery(ctx: ApiContext, user: User, ticket: string): Promise<User> {
	const {cache, users} = ctx.services;
	const key = pendingRecoveryKey(ticket);
	const pending = await cache.get<PendingRecovery>(key);
	if (!pending) {
		return user;
	}
	await cache.delete(key);
	if (pending.userId !== user.id.toString()) {
		throw invalidRecoveryKeyError();
	}
	const kit = await recoveryKits.find(user.id);
	const rotated =
		kit !== null &&
		(await recoveryKits.replaceIfUnchanged({
			userId: user.id,
			expectedSecretHash: pending.expectedSecretHash,
			secretHash: pending.secretHash,
			createdAt: new Date(pending.createdAt),
		}));
	if (!kit || !rotated) {
		await cache.delete(`mfa-ticket:${ticket}`);
		throw invalidRecoveryKeyError();
	}
	let updatedUser: User;
	try {
		updatedUser = await AuthPassword.commitPasswordReset(ctx, {
			user,
			passwordHash: pending.passwordHash,
			webauthnIsSecondFactor: await resolveWebAuthnSecondFactor(ctx, user),
		});
	} catch (error) {
		await restoreRecoveryKit(user.id, pending.secretHash, kit);
		throw error;
	}
	await users.deleteAllPasswordResetTokens(user.id);
	return updatedUser;
}
