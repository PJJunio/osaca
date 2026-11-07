// SPDX-License-Identifier: AGPL-3.0-or-later

import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import {createTestAccount, createUniqueUsername} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {getInstanceConfigRepository, getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {AccountTiers, AccountVerificationNeeds} from '@osaca/constants/src/AccountTierConstants';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface Me {
	claimed: boolean;
	has_password: boolean;
	global_name: string | null;
	profile_restricted: boolean;
}

interface Registered {
	token: string;
	user_id: string;
}

describe('Claiming an account', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	async function createUnclaimed(username = 'drifter'): Promise<Registered> {
		return await createBuilderWithoutAuth<Registered>(harness)
			.post('/auth/register')
			.body({username, consent: true})
			.execute();
	}

	function claim(token: string, body: Record<string, unknown>) {
		return createBuilder<{user: Me; code_expires_at: string}>(harness, token).post('/users/@me/claim').body(body);
	}

	it('sets the password at claim and lets the account sign in with it', async () => {
		const account = await createUnclaimed();
		const claimed = await claim(account.token, {password: 'a-strong-password-1'}).execute();
		expect(claimed.user).toMatchObject({has_password: true, claimed: true});
		const login = await createBuilderWithoutAuth<{user_id: string}>(harness)
			.post('/auth/login')
			.body({login: 'drifter', password: 'a-strong-password-1'})
			.execute();
		expect(login.user_id).toBe(account.user_id);
	});

	it('refuses a second claim and a claim without a password', async () => {
		const account = await createTestAccount(harness);
		await claim(account.token, {password: 'another-strong-password'})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.ACCOUNT_ALREADY_CLAIMED)
			.execute();
		const unclaimed = await createUnclaimed();
		await claim(unclaimed.token, {}).expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY').execute();
	});
});

describe('Account limits by tier', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
		await getInstanceConfigRepository().updateAccountsConfig({interaction_tier: 'enforced'});
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	async function createUnclaimed(): Promise<Registered> {
		return await createBuilderWithoutAuth<Registered>(harness)
			.post('/auth/register')
			.body({username: createUniqueUsername('quiet'), consent: true})
			.execute();
	}

	it('lets an unclaimed account edit its profile, and others see only the username and tag', async () => {
		const account = await createUnclaimed();
		const viewer = await createTestAccount(harness);
		await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({global_name: 'Visible Only To Me', bio: 'hidden bio'})
			.execute();
		const own = await createBuilder<Me>(harness, account.token).get('/users/@me').execute();
		expect(own).toMatchObject({global_name: 'Visible Only To Me', profile_restricted: true});
		const seen = await createBuilder<{global_name: string | null; username: string}>(harness, viewer.token)
			.get(`/users/${account.user_id}`)
			.execute();
		expect(seen.global_name).toBeNull();
		expect(seen.username).toMatch(/^quiet/);
		const guild = await createBuilder<{id: string; system_channel_id: string}>(harness, viewer.token)
			.post('/guilds')
			.body({name: 'Shared'})
			.execute();
		const invite = await createBuilder<{code: string}>(harness, viewer.token)
			.post(`/channels/${guild.system_channel_id}/invites`)
			.body({})
			.execute();
		await createBuilder(harness, account.token).post(`/invites/${invite.code}`).body(null).execute();
		const profile = await createBuilder<{user_profile: {bio: string | null}}>(harness, viewer.token)
			.get(`/users/${account.user_id}/profile`)
			.execute();
		expect(profile.user_profile.bio).toBeNull();
	});

	it('keeps the old limits for unclaimed profile edits in legacy mode', async () => {
		await getInstanceConfigRepository().updateAccountsConfig({interaction_tier: 'legacy'});
		const account = await createUnclaimed();
		await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({global_name: 'Not Yet'})
			.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
			.execute();
	});

	it('refuses invites and reports from unclaimed accounts only where they reach others', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createBuilder<{id: string; system_channel_id: string}>(harness, owner.token)
			.post('/guilds')
			.body({name: 'Tier Guild'})
			.execute();
		const unclaimed = await createUnclaimed();
		await createBuilder(harness, unclaimed.token)
			.post(`/channels/${guild.system_channel_id}/invites`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.ACCOUNT_VERIFICATION_REQUIRED)
			.execute();
		const reporter = await createUnclaimed();
		const report = await createBuilder<{report_id: string}>(harness, reporter.token)
			.post('/reports/user')
			.body({user_id: owner.userId, category: 'harassment'})
			.execute();
		expect(report.report_id).toBeTruthy();
	});

	it('drops a second report on the same target from the same network', async () => {
		const target = await createTestAccount(harness);
		const first = await createUnclaimed();
		const second = await createUnclaimed();
		const send = (token: string) =>
			createBuilder<{report_id: string}>(harness, token)
				.post('/reports/user')
				.header('x-forwarded-for', '203.0.113.20')
				.body({user_id: target.userId, category: 'harassment'})
				.execute();
		const kept = await send(first.token);
		const dropped = await send(second.token);
		const {getReportRepository} = await import('@app/api/middleware/ServiceSingletons');
		const {createReportID} = await import('@app/api/BrandedTypes');
		expect(await getReportRepository().getReport(createReportID(BigInt(kept.report_id)))).not.toBeNull();
		expect(await getReportRepository().getReport(createReportID(BigInt(dropped.report_id)))).toBeNull();
	});
});

describe('Claim tier payloads', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	interface TierMe {
		account_tier: string;
		verification_need: string | null;
		claimed: boolean;
	}

	async function createUnclaimed(username = 'drifter'): Promise<Registered> {
		return await createBuilderWithoutAuth<Registered>(harness)
			.post('/auth/register')
			.body({username, consent: true})
			.execute();
	}

	function tierOf(token: string): Promise<TierMe> {
		return createBuilder<TierMe>(harness, token).get('/users/@me').execute();
	}

	it('reports the tier and the next need in the private user payload as the account is claimed', async () => {
		const account = await createUnclaimed();
		expect(await tierOf(account.token)).toMatchObject({
			account_tier: AccountTiers.UNCLAIMED,
			verification_need: AccountVerificationNeeds.SET_PASSWORD,
			claimed: false,
		});
		const claimed = await createBuilder<{user: TierMe}>(harness, account.token)
			.post('/users/@me/claim')
			.body({password: 'a-strong-password-5'})
			.execute();
		expect(claimed.user).toMatchObject({account_tier: AccountTiers.VERIFIED, verification_need: null, claimed: true});
	});

	it('includes the tier in the admin user payload', async () => {
		const unclaimed = await createUnclaimed();
		const verified = await createTestAccount(harness);
		const users = getUserRepository();
		const unclaimedUser = await users.findUniqueAssert(createUserID(BigInt(unclaimed.user_id)));
		const verifiedUser = await users.findUniqueAssert(createUserID(BigInt(verified.userId)));
		expect(await mapUserToAdminResponse(unclaimedUser)).toMatchObject({
			account_tier: AccountTiers.UNCLAIMED,
			claimed: false,
		});
		expect(await mapUserToAdminResponse(verifiedUser)).toMatchObject({
			account_tier: AccountTiers.VERIFIED,
			claimed: true,
		});
	});
});
