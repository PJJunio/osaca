// SPDX-License-Identifier: AGPL-3.0-or-later

import crypto from 'node:crypto';
import {resetPwnedPasswordCacheForTesting} from '@app/api/auth/AuthPassword';
import {findRecoveryKitCreatedAt} from '@app/api/auth/AuthRecoveryKit';
import {
	createAuthHarness,
	createTestAccount,
	createUniqueUsername,
	type TestAccount,
	totpCodeNow,
} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {getConfig} from '@app/api/Config';
import {
	REGISTRATION_PENDING_APPROVAL_TRAIT,
	REGISTRATION_REJECTED_TRAIT,
} from '@app/api/instance/InstanceConfigRepository';
import {getUserRepository} from '@app/api/middleware/ServiceSingletons';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {server} from '@app/api/test/msw/server';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {HttpResponse, http} from 'msw';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const NEW_PASSWORD = 'recovered-strong-password-123';
const RECOVERY_KEY_PATTERN = /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){7}$/;

interface ValidationErrorBody {
	code: string;
	errors: Array<{path: string; code: string}>;
}

interface RecoveryKitStatus {
	has_recovery_kit: boolean;
	created_at: string | null;
}

interface RecoveryKitCreated {
	recovery_key: string;
	created_at: string;
}

interface RecoverTokenResponse {
	token: string;
	user_id: string;
	recovery_key: string;
	recovery_kit_created_at: string;
}

interface RecoverMfaResponse {
	mfa: true;
	ticket: string;
	totp: boolean;
	recovery_key: string;
	recovery_kit_created_at: string;
}

describe('Recovery kit', () => {
	let harness: ApiTestHarness;
	let originalSelfHosted: boolean;
	let originalBreachedPasswordCheck: boolean;

	beforeAll(async () => {
		harness = await createAuthHarness();
	});
	beforeEach(async () => {
		await harness.reset();
		const config = getConfig();
		originalSelfHosted = config.instance.selfHosted;
		originalBreachedPasswordCheck = config.breachedPasswordCheck.enabled;
		config.instance.selfHosted = true;
	});
	afterEach(() => {
		const config = getConfig();
		config.instance.selfHosted = originalSelfHosted;
		config.breachedPasswordCheck.enabled = originalBreachedPasswordCheck;
		resetPwnedPasswordCacheForTesting();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	async function createAccount(): Promise<TestAccount & {username: string}> {
		const config = getConfig();
		config.instance.selfHosted = false;
		try {
			const username = createUniqueUsername('kit');
			const account = await createTestAccount(harness, {username});
			return {...account, username};
		} finally {
			config.instance.selfHosted = true;
		}
	}

	async function createKit(account: TestAccount, password = account.password): Promise<RecoveryKitCreated> {
		return await createBuilder<RecoveryKitCreated>(harness, account.token)
			.post('/users/@me/recovery-kit')
			.body({password})
			.execute();
	}

	async function getStatus(account: TestAccount): Promise<RecoveryKitStatus> {
		return await createBuilder<RecoveryKitStatus>(harness, account.token).get('/users/@me/recovery-kit').execute();
	}

	async function expectInvalidRecoveryKey(body: Record<string, unknown>): Promise<void> {
		const {json} = await createBuilderWithoutAuth<ValidationErrorBody>(harness)
			.post('/auth/recover')
			.body(body)
			.expect(400, 'INVALID_FORM_BODY')
			.executeWithResponse();
		expect(errorFields(json)).toEqual([{path: 'recovery_key', code: ValidationErrorCodes.INVALID_RECOVERY_KEY}]);
	}

	function errorFields(body: ValidationErrorBody): Array<{path: string; code: string}> {
		return body.errors.map(({path, code}) => ({path, code}));
	}

	function sloppyKey(key: string): string {
		return key.replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l').toLowerCase();
	}

	it('reports no kit, creates one behind sudo and reports it', async () => {
		const account = await createAccount();
		expect(await getStatus(account)).toEqual({has_recovery_kit: false, created_at: null});
		await createBuilder(harness, account.token)
			.post('/users/@me/recovery-kit')
			.body({})
			.expect(403, APIErrorCodes.SUDO_MODE_REQUIRED)
			.execute();
		await createBuilder(harness, account.token)
			.post('/users/@me/recovery-kit')
			.body({password: 'not-the-right-password'})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
		expect(await getStatus(account)).toEqual({has_recovery_kit: false, created_at: null});
		const kit = await createKit(account);
		expect(kit.recovery_key).toMatch(RECOVERY_KEY_PATTERN);
		expect(await getStatus(account)).toEqual({has_recovery_kit: true, created_at: kit.created_at});
	});

	it('replaces the previous kit when a new one is created', async () => {
		const account = await createAccount();
		const first = await createKit(account);
		const second = await createKit(account);
		expect(second.recovery_key).not.toBe(first.recovery_key);
		await expectInvalidRecoveryKey({login: account.username, recovery_key: first.recovery_key, password: NEW_PASSWORD});
	});

	it('recovers the account, ends every session and rotates the kit', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const recovered = await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: sloppyKey(kit.recovery_key), password: NEW_PASSWORD})
			.execute();
		expect(recovered.user_id).toBe(account.userId);
		expect(recovered.token).toBeTruthy();
		expect(recovered.recovery_key).toMatch(RECOVERY_KEY_PATTERN);
		expect(recovered.recovery_key).not.toBe(kit.recovery_key);
		await createBuilder(harness, account.token).get('/users/@me').expect(401).execute();
		const recoveredAccount = {...account, token: recovered.token, password: NEW_PASSWORD};
		expect(await getStatus(recoveredAccount)).toEqual({
			has_recovery_kit: true,
			created_at: recovered.recovery_kit_created_at,
		});
		await expectInvalidRecoveryKey({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD});
		await createBuilder(harness, recovered.token)
			.post('/users/@me/recovery-kit')
			.body({password: account.password})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
		await createKit(recoveredAccount);
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({login: account.username, password: account.password})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
		const login = await createBuilderWithoutAuth<{user_id: string}>(harness)
			.post('/auth/login')
			.body({login: account.username, password: NEW_PASSWORD})
			.execute();
		expect(login.user_id).toBe(account.userId);
	});

	it('accepts the full tag and the new key works for the next recovery', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const me = await createBuilder<{discriminator: string}>(harness, account.token).get('/users/@me').execute();
		const tag = `${account.username.toUpperCase()}#${me.discriminator}`;
		const first = await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.body({login: tag, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
		const second = await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: first.recovery_key, password: `${NEW_PASSWORD}-again`})
			.execute();
		expect(second.user_id).toBe(account.userId);
		await expectInvalidRecoveryKey({
			login: `${account.username}#${me.discriminator === '9999' ? '0001' : '9999'}`,
			recovery_key: second.recovery_key,
			password: NEW_PASSWORD,
		});
	});

	it('gives the same error for a wrong key, a malformed key, an unknown user and a missing kit', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const otherKit = await createKit(await createAccount());
		await expectInvalidRecoveryKey({
			login: account.username,
			recovery_key: otherKit.recovery_key,
			password: NEW_PASSWORD,
		});
		await expectInvalidRecoveryKey({
			login: account.username,
			recovery_key: kit.recovery_key.replace(/^./, 'U'),
			password: NEW_PASSWORD,
		});
		await expectInvalidRecoveryKey({login: account.username, recovery_key: 'not-a-key', password: NEW_PASSWORD});
		await expectInvalidRecoveryKey({
			login: createUniqueUsername('ghost'),
			recovery_key: kit.recovery_key,
			password: NEW_PASSWORD,
		});
		const noKit = await createAccount();
		await expectInvalidRecoveryKey({login: noKit.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD});
		expect(await getStatus(account)).toEqual({has_recovery_kit: true, created_at: kit.created_at});
	});

	it('refuses a breached password without using up the kit', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const breached = 'breached-password-for-recovery';
		const hash = crypto.createHash('sha1').update(breached).digest('hex').toUpperCase();
		getConfig().breachedPasswordCheck.enabled = true;
		resetPwnedPasswordCacheForTesting();
		server.use(
			http.get('https://api.pwnedpasswords.com/range/:prefix', () => HttpResponse.text(`${hash.slice(5)}:42`)),
		);
		const {json} = await createBuilderWithoutAuth<ValidationErrorBody>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: breached})
			.expect(400, 'INVALID_FORM_BODY')
			.executeWithResponse();
		expect(errorFields(json)).toEqual([{path: 'password', code: ValidationErrorCodes.PASSWORD_IS_TOO_COMMON}]);
		expect(await getStatus(account)).toEqual({has_recovery_kit: true, created_at: kit.created_at});
		await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
	});

	async function enableTotp(account: TestAccount): Promise<string> {
		const secret = 'JBSWY3DPEHPK3PXP';
		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCodeNow(secret), password: account.password})
			.execute();
		return secret;
	}

	it('changes nothing until the second factor passes on an account with two-factor authentication', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const secret = await enableTotp(account);
		const recovered = await createBuilderWithoutAuth<RecoverMfaResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
		expect(recovered.mfa).toBe(true);
		expect(recovered.totp).toBe(true);
		expect(recovered.ticket).toBeTruthy();
		expect(recovered.recovery_key).toMatch(RECOVERY_KEY_PATTERN);
		expect('token' in recovered).toBe(false);
		await createBuilder(harness, account.token).get('/users/@me').expect(200).execute();
		expect(await getStatus(account)).toEqual({has_recovery_kit: true, created_at: kit.created_at});
		const oldPasswordLogin = await createBuilderWithoutAuth<{mfa: boolean}>(harness)
			.post('/auth/login')
			.body({login: account.username, password: account.password})
			.execute();
		expect(oldPasswordLogin.mfa).toBe(true);
		const login = await createBuilderWithoutAuth<{token: string; user_id: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({ticket: recovered.ticket, code: totpCodeNow(secret)})
			.execute();
		expect(login.user_id).toBe(account.userId);
		await createBuilder(harness, account.token).get('/users/@me').expect(401).execute();
		const recoveredAccount = {...account, token: login.token, password: NEW_PASSWORD};
		expect(await getStatus(recoveredAccount)).toEqual({
			has_recovery_kit: true,
			created_at: recovered.recovery_kit_created_at,
		});
		await expectInvalidRecoveryKey({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD});
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({login: account.username, password: account.password})
			.expect(400, 'INVALID_FORM_BODY')
			.execute();
		const newPasswordLogin = await createBuilderWithoutAuth<{mfa: boolean}>(harness)
			.post('/auth/login')
			.body({login: account.username, password: NEW_PASSWORD})
			.execute();
		expect(newPasswordLogin.mfa).toBe(true);
		const next = await createBuilderWithoutAuth<RecoverMfaResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: recovered.recovery_key, password: `${NEW_PASSWORD}-again`})
			.execute();
		expect(next.mfa).toBe(true);
	});

	it('keeps the old kit working when the second factor is never given', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		await enableTotp(account);
		const abandoned = await createBuilderWithoutAuth<RecoverMfaResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
		await expectInvalidRecoveryKey({
			login: account.username,
			recovery_key: abandoned.recovery_key,
			password: NEW_PASSWORD,
		});
		const retried = await createBuilderWithoutAuth<RecoverMfaResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
		expect(retried.mfa).toBe(true);
		expect(await getStatus(account)).toEqual({has_recovery_kit: true, created_at: kit.created_at});
	});

	it('refuses a second factor on a stale recovery once the kit changed', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const secret = await enableTotp(account);
		const recovered = await createBuilderWithoutAuth<RecoverMfaResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
		const replacement = await createBuilder<RecoveryKitCreated>(harness, account.token)
			.post('/users/@me/recovery-kit')
			.body({mfa_method: 'totp', mfa_code: totpCodeNow(secret)})
			.execute();
		const {json} = await createBuilderWithoutAuth<ValidationErrorBody>(harness)
			.post('/auth/login/mfa/totp')
			.body({ticket: recovered.ticket, code: totpCodeNow(secret)})
			.expect(400, 'INVALID_FORM_BODY')
			.executeWithResponse();
		expect(errorFields(json)).toEqual([{path: 'recovery_key', code: ValidationErrorCodes.INVALID_RECOVERY_KEY}]);
		await createBuilder(harness, account.token).get('/users/@me').expect(200).execute();
		expect(await getStatus(account)).toEqual({has_recovery_kit: true, created_at: replacement.created_at});
	});

	it('puts the old kit back when the reset fails after the kit was rotated', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const users = getUserRepository();
		const userId = createUserID(BigInt(account.userId));
		const user = await users.findUniqueAssert(userId);
		await users.patchUpsert(userId, {traits: new Set(['registration_pending_approval'])}, user.toRow());
		await createBuilderWithoutAuth(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.expect(403)
			.execute();
		expect((await findRecoveryKitCreatedAt(userId))?.toISOString()).toBe(kit.created_at);
	});

	it('lifts an expired temporary ban and sets the password on the lifted account', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const users = getUserRepository();
		const userId = createUserID(BigInt(account.userId));
		const user = await users.findUniqueAssert(userId);
		await users.patchUpsert(
			userId,
			{flags: user.flags | UserFlags.DISABLED, temp_banned_until: new Date(Date.now() - 60_000)},
			user.toRow(),
		);
		await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
		const after = await users.findUniqueAssert(userId);
		expect(after.flags & UserFlags.DISABLED).toBe(0n);
		expect(after.tempBannedUntil).toBeNull();
		expect(after.passwordLastChangedAt).not.toBeNull();
	});

	it('reports when the kit was created for the data export', async () => {
		const account = await createAccount();
		const userId = createUserID(BigInt(account.userId));
		expect(await findRecoveryKitCreatedAt(userId)).toBeNull();
		const kit = await createKit(account);
		expect((await findRecoveryKitCreatedAt(userId))?.toISOString()).toBe(kit.created_at);
	});

	it('limits attempts per account from one source without locking out others', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const wrongKit = await createKit(await createAccount());
		for (let attempt = 0; attempt < 5; attempt++) {
			await createBuilderWithoutAuth(harness)
				.post('/auth/recover')
				.header('x-forwarded-for', '198.51.100.20')
				.body({login: account.username, recovery_key: wrongKit.recovery_key, password: NEW_PASSWORD})
				.expect(400, 'INVALID_FORM_BODY')
				.execute();
		}
		await createBuilderWithoutAuth(harness)
			.post('/auth/recover')
			.header('x-forwarded-for', '198.51.100.20')
			.body({login: account.username.toUpperCase(), recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.expect(429)
			.execute();
		await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.header('x-forwarded-for', '198.51.100.21')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
	});

	it('keeps identifiers that are not usernames out of every named bucket', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		for (let attempt = 0; attempt < 5; attempt++) {
			await createBuilderWithoutAuth(harness)
				.post('/auth/recover')
				.header('x-forwarded-for', '198.51.100.25')
				.body({
					login: `${account.username}:198.51.100.${attempt}`,
					recovery_key: kit.recovery_key,
					password: NEW_PASSWORD,
				})
				.expect(400, 'INVALID_FORM_BODY')
				.execute();
		}
		await createBuilderWithoutAuth(harness)
			.post('/auth/recover')
			.header('x-forwarded-for', '198.51.100.25')
			.body({login: 'not a username', recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.expect(429)
			.execute();
		await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.header('x-forwarded-for', '198.51.100.25')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
	});

	it('limits attempts per IP address', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		for (let attempt = 0; attempt < 10; attempt++) {
			await createBuilderWithoutAuth(harness)
				.post('/auth/recover')
				.header('x-forwarded-for', '198.51.100.30')
				.body({login: createUniqueUsername('ghost'), recovery_key: kit.recovery_key, password: NEW_PASSWORD})
				.expect(400, 'INVALID_FORM_BODY')
				.execute();
		}
		await createBuilderWithoutAuth(harness)
			.post('/auth/recover')
			.header('x-forwarded-for', '198.51.100.30')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.expect(429)
			.execute();
		await createBuilderWithoutAuth<RecoverTokenResponse>(harness)
			.post('/auth/recover')
			.header('x-forwarded-for', '198.51.100.31')
			.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
			.execute();
	});

	it('deletes the kit when the password changes', async () => {
		const account = await createAccount();
		await createKit(account);
		const changed = await createBuilder<{token: string}>(harness, account.token)
			.post('/users/@me/password')
			.body({password: account.password, new_password: NEW_PASSWORD})
			.execute();
		expect(await getStatus({...account, token: changed.token})).toEqual({has_recovery_kit: false, created_at: null});
	});

	it('refuses recovery for a registration awaiting approval or rejected', async () => {
		const account = await createAccount();
		const kit = await createKit(account);
		const users = getUserRepository();
		const userId = createUserID(BigInt(account.userId));
		const changedBefore = (await users.findUniqueAssert(userId)).passwordLastChangedAt;
		for (const [trait, code] of [
			[REGISTRATION_PENDING_APPROVAL_TRAIT, APIErrorCodes.REGISTRATION_PENDING_APPROVAL],
			[REGISTRATION_REJECTED_TRAIT, APIErrorCodes.REGISTRATION_REJECTED],
		] as const) {
			const user = await users.findUniqueAssert(userId);
			await users.patchUpsert(userId, {traits: new Set([trait])}, user.toRow());
			await createBuilderWithoutAuth(harness)
				.post('/auth/recover')
				.body({login: account.username, recovery_key: kit.recovery_key, password: NEW_PASSWORD})
				.expect(403, code)
				.execute();
		}
		expect((await findRecoveryKitCreatedAt(userId))?.toISOString()).toBe(kit.created_at);
		expect((await users.findUniqueAssert(userId)).passwordLastChangedAt).toEqual(changedBefore);
	});
});
