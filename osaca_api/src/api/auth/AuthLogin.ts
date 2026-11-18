// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {shouldEnforceAccountBudgets} from '@app/api/auth/AccountBudgets';
import * as AuthMfa from '@app/api/auth/AuthMfa';
import {applyPendingRecovery} from '@app/api/auth/AuthRecoveryKit';
import * as AuthSession from '@app/api/auth/AuthSession';
import * as AuthUtility from '@app/api/auth/AuthUtility';
import {resolveWebAuthnSecondFactor} from '@app/api/auth/services/WebAuthnSecondFactor';
import {recordUsernameFailure, usernameKey} from '@app/api/auth/UsernameFailures';
import {createInviteCode, createMfaTicket, createUserID} from '@app/api/BrandedTypes';
import {emitActivity} from '@app/api/infrastructure/activity/ActivityEvents';
import type {LoginMethod} from '@app/api/infrastructure/activity/Contract.generated';
import {
	REGISTRATION_PENDING_APPROVAL_TRAIT,
	REGISTRATION_REJECTED_TRAIT,
} from '@app/api/instance/InstanceConfigRepository';
import type {InviteService} from '@app/api/invite/InviteService';
import {Logger} from '@app/api/Logger';
import {createRequestCache} from '@app/api/middleware/RequestCacheMiddleware';
import type {AuthSession as AuthSessionModel} from '@app/api/models/AuthSession';
import type {User} from '@app/api/models/User';
import {tierContextFromRequest} from '@app/api/user/AccountTier';
import {findPersonByLoginHandle, parseLoginHandle} from '@app/api/user/UniqueUsernames';
import {verifyPassword} from '@app/api/utils/PasswordUtils';
import * as RandomUtils from '@app/api/utils/RandomUtils';
import {createRateLimitError} from '@app/api/utils/RateLimitUtils';
import {UserAuthenticatorTypes} from '@osaca/constants/src/UserConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {MfaNotEnabledError} from '@osaca/errors/src/domains/auth/MfaNotEnabledError';
import {RegistrationPendingApprovalError} from '@osaca/errors/src/domains/auth/RegistrationPendingApprovalError';
import {RegistrationRejectedError} from '@osaca/errors/src/domains/auth/RegistrationRejectedError';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import type {LoginRequest} from '@osaca/schema/src/domains/auth/AuthSchemas';
import type {AuthenticationResponseJSON} from '@simplewebauthn/server';
import {ms, seconds} from 'itty-time';

const LOGIN_FAILURES_BEFORE_LOCKOUT = 100;

// The hard lockout, a leaky bucket that only applies while the captcha is off.
export function loginFailureLimit(login: string): LoginIdentifierRateLimit | null {
	const username = usernameKey(login);
	if (username === null) return null;
	return {identifier: `login:id:${username}`, maxAttempts: LOGIN_FAILURES_BEFORE_LOCKOUT, windowMs: ms('1 hour')};
}

const DUMMY_ARGON2_HASH =
	'$argon2id$v=19$m=65536,t=3,p=4$fT6tGpAyxFiz+n1RbkRqWQ$v05UT17QGeqhsgRjcVjIWcGw6gUDYeCcAA8FiZ63MtA';

interface LoginParams {
	data: LoginRequest;
	request: Request;
	captchaVerified?: boolean;
}

interface LoginMfaTotpParams {
	code: string;
	ticket: string;
	request: Request;
}

interface LoginMfaWebAuthnParams {
	response: AuthenticationResponseJSON;
	challenge: string;
	ticket: string;
	request: Request;
}

export interface LoginDependencies {
	inviteService: InviteService;
}

interface LoginTokenResult {
	user_id: string;
	token: string;
}

export interface LoginMfaResult {
	mfa: true;
	ticket: string;
	allowed_methods: Array<string>;
	totp: boolean;
	webauthn: boolean;
	backup_codes: boolean;
}

type LoginResult = LoginTokenResult | LoginMfaResult;

interface LoginIdentifierRateLimit {
	identifier: string;
	maxAttempts: number;
	windowMs: number;
}

interface LoginIdentifier {
	failureRateLimit: LoginIdentifierRateLimit | null;
	lookup: () => Promise<User | null>;
}

export function emitLogin(
	user: User,
	ok: boolean,
	details: {failure?: string; mfa?: boolean; method?: LoginMethod} = {},
): void {
	void emitActivity('login', user.id.toString(), {
		user_id: user.id.toString(),
		ok,
		method: details.method ?? 'password',
		failure: details.failure ?? null,
		mfa: details.mfa ?? false,
		// The contract keeps the field; OSACA tracks no client addresses to compare (ADR-0009).
		new_ip: false,
	});
}

export async function login(
	ctx: ApiContext,
	deps: LoginDependencies,
	{data, request, captchaVerified = false}: LoginParams,
): Promise<LoginResult> {
	const {rateLimit} = ctx.services;
	const {inviteService} = deps;
	const skipRateLimits = !shouldEnforceAccountBudgets(request);
	const identifier = resolveLoginIdentifier(ctx, data);
	const invalidCredentials = () =>
		InputValidationError.fromCodes([
			{path: 'login', code: ValidationErrorCodes.INVALID_LOGIN_OR_PASSWORD},
			{path: 'password', code: ValidationErrorCodes.INVALID_LOGIN_OR_PASSWORD},
		]);
	const failureLimit = identifier.failureRateLimit;
	const failureState = failureLimit ? await rateLimit.peekLimit(failureLimit) : null;
	// A solved captcha already pays a cost that grows with the failures, so the hard lockout is only for an Instance
	// that turned the captcha off. It would otherwise lock the owner out too.
	const failureLockout =
		failureLimit && failureState !== null && failureState.remaining === 0 && !skipRateLimits && !captchaVerified
			? {
					...failureState,
					allowed: false,
					retryAfter: Math.ceil(failureLimit.windowMs / failureLimit.maxAttempts / 1000),
				}
			: null;
	const rejectCredentials = async (): Promise<never> => {
		await recordUsernameFailure(ctx.services.kv, 'login', data.login);
		if (failureLimit) {
			await rateLimit.checkLimit(failureLimit);
		}
		if (failureLockout) {
			throw createRateLimitError(failureLockout);
		}
		throw invalidCredentials();
	};
	const user = await identifier.lookup();
	if (!user) {
		await verifyPassword({password: data.password, passwordHash: DUMMY_ARGON2_HASH});
		return await rejectCredentials();
	}
	AuthUtility.assertNonBotUser(ctx, user);
	if (!user.passwordHash) {
		await verifyPassword({password: data.password, passwordHash: DUMMY_ARGON2_HASH});
		emitLogin(user, false, {failure: 'no_password'});
		return await rejectCredentials();
	}
	const isMatch = await verifyPassword({
		password: data.password,
		passwordHash: user.passwordHash,
	});
	if (!isMatch) {
		emitLogin(user, false, {failure: 'bad_password'});
		return await rejectCredentials();
	}
	if (failureLockout) {
		throw createRateLimitError(failureLockout);
	}
	const hasMfa =
		user.authenticatorTypes.has(UserAuthenticatorTypes.TOTP) ||
		user.authenticatorTypes.has(UserAuthenticatorTypes.WEBAUTHN);
	const currentUser = hasMfa ? user : await AuthUtility.assertSignInAllowed(ctx, user);
	if (currentUser.traits.has(REGISTRATION_PENDING_APPROVAL_TRAIT)) {
		throw new RegistrationPendingApprovalError();
	}
	if (currentUser.traits.has(REGISTRATION_REJECTED_TRAIT)) {
		throw new RegistrationRejectedError();
	}
	if (hasMfa) {
		const webauthnIsSecondFactor = await resolveWebAuthnSecondFactor(ctx, currentUser);
		return await createMfaTicketResponse(ctx, currentUser, webauthnIsSecondFactor);
	}
	if (data.invite_code) {
		try {
			await inviteService.acceptInvite({
				userId: currentUser.id,
				inviteCode: createInviteCode(data.invite_code),
				requestCache: createRequestCache(),
				tierContext: tierContextFromRequest(request),
			});
		} catch (error) {
			Logger.warn({inviteCode: data.invite_code, error}, 'Failed to auto-join invite on login');
		}
	}
	const [token] = await AuthSession.createAuthSession(ctx, {
		user: currentUser,
		origin: AuthSession.resolveSessionOrigin(ctx, request),
	});
	emitLogin(currentUser, true);
	return {
		user_id: currentUser.id.toString(),
		token,
	};
}

function resolveLoginIdentifier(ctx: ApiContext, data: LoginRequest): LoginIdentifier {
	const {users} = ctx.services;
	const handle = parseLoginHandle(data.login);
	return {
		failureRateLimit: loginFailureLimit(data.login),
		lookup: async () => (handle ? await findPersonByLoginHandle(users, handle) : null),
	};
}

const MFA_TICKET_MAX_ATTEMPTS = 5;
const MFA_USER_MAX_ATTEMPTS = 10;

export async function consumeMfaAttempt(
	ctx: ApiContext,
	{userId, ticket, field}: {userId: string; ticket: string; field: string},
): Promise<void> {
	const {cache, rateLimit} = ctx.services;
	const userLimit = await rateLimit.checkLimit({
		identifier: `mfa:user:${userId}`,
		maxAttempts: MFA_USER_MAX_ATTEMPTS,
		windowMs: ms('15 minutes'),
	});
	if (!userLimit.allowed) {
		throw InputValidationError.fromCode(field, ValidationErrorCodes.INVALID_CODE);
	}
	const ticketLimit = await rateLimit.checkLimit({
		identifier: `mfa:ticket:${ticket}`,
		maxAttempts: MFA_TICKET_MAX_ATTEMPTS,
		windowMs: ms('5 minutes'),
	});
	if (!ticketLimit.allowed) {
		await cache.delete(`mfa-ticket:${ticket}`);
		throw InputValidationError.fromCode(field, ValidationErrorCodes.INVALID_CODE);
	}
}

export async function loginMfaTotp(
	ctx: ApiContext,
	{code, ticket, request}: LoginMfaTotpParams,
): Promise<LoginTokenResult> {
	const user = await requireMfaTicketUser(ctx, ticket);
	const hasTotp = Boolean(user.totpSecret) && user.authenticatorTypes.has(UserAuthenticatorTypes.TOTP);
	if (!hasTotp && !(await AuthMfa.hasUnconsumedBackupCodes(ctx, user.id))) {
		throw InputValidationError.fromCode('code', ValidationErrorCodes.TOTP_NOT_ENABLED);
	}
	await consumeMfaAttempt(ctx, {userId: user.id.toString(), ticket, field: 'code'});
	const isValid = await AuthMfa.verifyMfaCode(ctx, {
		userId: user.id,
		mfaSecret: hasTotp ? user.totpSecret : null,
		code,
		allowBackup: true,
	});
	if (!isValid) {
		throw InputValidationError.fromCode('code', ValidationErrorCodes.INVALID_CODE);
	}
	const [token] = await completeMfaLogin(ctx, user, ticket, request);
	return {user_id: user.id.toString(), token};
}

export async function createLoginSession(
	ctx: ApiContext,
	user: User,
	request: Request,
): Promise<[token: string, AuthSessionModel]> {
	return AuthSession.createAuthSession(ctx, {user, origin: AuthSession.resolveSessionOrigin(ctx, request)});
}

export async function completeMfaLogin(
	ctx: ApiContext,
	user: User,
	ticket: string,
	request: Request,
): Promise<[token: string, AuthSessionModel]> {
	const {cache, rateLimit} = ctx.services;
	const sessionUser = await applyPendingRecovery(ctx, user, ticket);
	await cache.delete(`mfa-ticket:${ticket}`);
	await rateLimit.resetLimit(`mfa:ticket:${ticket}`);
	await rateLimit.resetLimit(`mfa:user:${user.id}`);
	const session = await createLoginSession(ctx, sessionUser, request);
	emitLogin(sessionUser, true, {mfa: true});
	return session;
}

export async function loginMfaWebAuthn(
	ctx: ApiContext,
	{response, challenge, ticket, request}: LoginMfaWebAuthnParams,
): Promise<LoginTokenResult> {
	const user = await requireMfaTicketUser(ctx, ticket);
	if (!(await resolveWebAuthnSecondFactor(ctx, user))) {
		throw new MfaNotEnabledError();
	}
	await consumeMfaAttempt(ctx, {userId: user.id.toString(), ticket, field: 'ticket'});
	await AuthMfa.verifyWebAuthnAuthentication(ctx, user.id, response, challenge, 'mfa', ticket);
	const [token] = await completeMfaLogin(ctx, user, ticket, request);
	return {user_id: user.id.toString(), token};
}

export async function createMfaTicketResponse(
	ctx: ApiContext,
	user: User,
	webauthnIsSecondFactor: boolean,
): Promise<LoginMfaResult> {
	const {cache} = ctx.services;
	const ticket = createMfaTicket(await RandomUtils.randomString(64));
	await cache.set(`mfa-ticket:${ticket}`, user.id.toString(), seconds('5 minutes'));
	const hasTotp = user.authenticatorTypes.has(UserAuthenticatorTypes.TOTP);
	const hasBackupCodes = await AuthMfa.hasUnconsumedBackupCodes(ctx, user.id);
	const allowedMethods: Array<string> = [];
	if (hasTotp) allowedMethods.push('totp');
	if (webauthnIsSecondFactor) allowedMethods.push('webauthn');
	if (hasBackupCodes) allowedMethods.push('backup_codes');
	return {
		mfa: true,
		ticket,
		allowed_methods: allowedMethods,
		totp: hasTotp,
		webauthn: webauthnIsSecondFactor,
		backup_codes: hasBackupCodes,
	};
}

export async function requireMfaTicketUser(ctx: ApiContext, ticket: string, expectedUserId?: string): Promise<User> {
	const userId = await ctx.services.cache.get<string>(`mfa-ticket:${ticket}`);
	if (!userId || (expectedUserId !== undefined && userId !== expectedUserId)) {
		throw InputValidationError.fromCode('ticket', ValidationErrorCodes.SESSION_TIMEOUT);
	}
	const user = await ctx.services.users.findUniqueAssert(createUserID(BigInt(userId)));
	AuthUtility.assertNonBotUser(ctx, user);
	return user;
}
