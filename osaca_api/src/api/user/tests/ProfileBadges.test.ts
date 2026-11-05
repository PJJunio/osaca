// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestCustomBadge} from '@app/api/admin/tests/AdminTestUtils';
import {createTestAccount, setUserACLs, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {acceptInvite, createChannelInvite, createGuild, getGuildChannels} from '@app/api/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {PROFILE_BADGE_ASSETS} from '@app/api/user/profile_badges/ProfileBadgeAssets';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {ProfilePrivacyLevels, PublicUserFlags, UserFlags} from '@osaca/constants/src/UserConstants';
import type {UserAdminResponse} from '@osaca/schema/src/domains/admin/AdminUserSchemas';
import type {
	ProfileBadgePreviewResponse,
	ProfileBadgeResponse,
} from '@osaca/schema/src/domains/user/ProfileBadgeSchemas';
import type {UserPrivateResponse, UserProfileFullResponse} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

type ProfileWithBadges = UserProfileFullResponse & {profile_badges: Array<ProfileBadgeResponse>};

const PUBLIC_BADGE_FLAGS = PublicUserFlags.STAFF | PublicUserFlags.PARTNER | PublicUserFlags.BUG_HUNTER;

describe('profile badges', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	afterAll(async () => {
		await harness.shutdown();
	});
	beforeEach(async () => {
		await harness.resetData();
	});

	async function shareGuild(owner: TestAccount, member: TestAccount): Promise<void> {
		const guild = await createGuild(harness, owner.token, 'Shared');
		const channels = await getGuildChannels(harness, owner.token, guild.id);
		const invite = await createChannelInvite(harness, owner.token, channels[0]!.id);
		await acceptInvite(harness, member.token, invite.code);
	}

	async function setFlags(account: TestAccount, flags: bigint): Promise<void> {
		await createBuilder(harness, '')
			.patch(`/test/users/${account.userId}/flags`)
			.body({flags: flags.toString()})
			.execute();
	}

	async function profile(
		viewer: TestAccount,
		target: TestAccount,
		acceptLanguage?: string,
	): Promise<ProfileWithBadges> {
		const builder = createBuilder<ProfileWithBadges>(harness, viewer.token).get(`/users/${target.userId}/profile`);
		if (acceptLanguage) builder.header('Accept-Language', acceptLanguage);
		return builder.expect(HTTP_STATUS.OK).execute();
	}

	async function preview(account: TestAccount, body: Record<string, unknown>): Promise<ProfileBadgePreviewResponse> {
		return createBuilder<ProfileBadgePreviewResponse>(harness, account.token)
			.post('/users/@me/profile-badges/preview')
			.body(body)
			.expect(HTTP_STATUS.OK)
			.execute();
	}

	const kinds = (response: {profile_badges: Array<{kind: string}>}) => response.profile_badges.map((b) => b.kind);

	test('profiles list the badges with assets and labels in the viewer locale', async () => {
		const target = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		await shareGuild(target, viewer);
		await setFlags(target, UserFlags.STAFF | UserFlags.BUG_HUNTER);
		const english = await profile(viewer, target);
		expect(english.profile_badges).toEqual([
			{
				key: 'staff',
				kind: 'staff',
				label: 'OSACA Staff',
				asset: PROFILE_BADGE_ASSETS.staff,
				asset_url: null,
				aspect_ratio: null,
				caption: null,
				href: expect.any(String),
			},
			{
				key: 'bug_hunter',
				kind: 'bug_hunter',
				label: 'OSACA Bug Hunter',
				asset: PROFILE_BADGE_ASSETS.bug_hunter,
				asset_url: null,
				aspect_ratio: null,
				caption: null,
				href: expect.any(String),
			},
		]);
	});

	test('the stored viewer locale beats the Accept-Language header', async () => {
		const target = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		await shareGuild(target, viewer);
		await setFlags(target, UserFlags.STAFF);
		const staffLabel = async (acceptLanguage: string) =>
			(await profile(viewer, target, acceptLanguage)).profile_badges.find((badge) => badge.kind === 'staff')?.label;
		await createBuilder(harness, viewer.token).patch('/users/@me/settings').body({locale: 'de'}).execute();
		expect(await staffLabel('ja')).toBe('OSACA-Mitarbeiter');
		await createBuilder(harness, viewer.token).patch('/users/@me/settings').body({locale: 'ja'}).execute();
		expect(await staffLabel('de')).toBe('OSACAスタッフ');
	});

	test('a restricted viewer only sees the flag badges', async () => {
		const target = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		await shareGuild(target, viewer);
		await setFlags(target, UserFlags.PARTNER);
		await createBuilder(harness, target.token)
			.patch('/users/@me/settings')
			.body({profile_privacy: ProfilePrivacyLevels.FRIENDS_ONLY})
			.execute();
		const response = await profile(viewer, target);
		expect(response.profile_limited).toBe(true);
		expect(kinds(response)).toEqual(['partner']);
		expect(kinds(await profile(target, target))).toEqual(['partner']);
	});

	test('hidden accounts show no badges', async () => {
		const target = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		await shareGuild(target, viewer);
		await setFlags(target, UserFlags.STAFF | UserFlags.PROFILE_HIDDEN);
		expect((await profile(viewer, target)).profile_badges).toEqual([]);
	});

	async function hideBadges(account: TestAccount, body: Record<string, unknown>): Promise<UserPrivateResponse> {
		return createBuilder<UserPrivateResponse>(harness, account.token)
			.patch('/users/@me')
			.body(body)
			.expect(HTTP_STATUS.OK)
			.execute();
	}

	test('the preview reflects each setting without saving it', async () => {
		const account = await createTestAccount(harness);
		await setFlags(account, UserFlags.STAFF | UserFlags.PARTNER);
		expect(kinds(await preview(account, {}))).toEqual(['staff', 'partner']);
		const hidden = await preview(account, {hidden_profile_badges: ['staff']});
		expect(kinds(hidden)).toEqual(['partner']);
		expect(hidden.own_badges.map(({key, hidden}) => [key, hidden])).toEqual([
			['staff', true],
			['partner', false],
		]);
		const saved = await createBuilder<UserPrivateResponse>(harness, account.token).get('/users/@me').execute();
		expect(saved.hidden_profile_badges).toEqual([]);
		expect(kinds(await profile(account, account))).toEqual(['staff', 'partner']);
	});

	test('hidden badges leave other people and the public flags but stay listed for you and staff', async () => {
		const admin = await setUserACLs(harness, await createTestAccount(harness), [AdminACLs.WILDCARD]);
		const target = await createTestAccount(harness);
		const viewer = await createTestAccount(harness);
		await shareGuild(target, viewer);
		await setFlags(target, UserFlags.STAFF | UserFlags.PARTNER | UserFlags.BUG_HUNTER);
		const custom = await createTestCustomBadge(harness, admin.token);
		await createBuilder(harness, admin.token)
			.patch(`/admin/users/${target.userId}/badges`)
			.body({badge_ids: [custom.id]})
			.expect(HTTP_STATUS.OK)
			.execute();
		const hidden = ['staff', 'bug_hunter', `custom:${custom.id}`];
		const saved = await hideBadges(target, {hidden_profile_badges: hidden});
		expect(saved.hidden_profile_badges).toEqual([...hidden].sort());

		expect(kinds(await profile(viewer, target))).toEqual(['partner']);
		const partial = await createBuilder<{flags: number}>(harness, viewer.token)
			.get(`/users/${target.userId}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(partial.flags & PUBLIC_BADGE_FLAGS).toBe(PublicUserFlags.PARTNER);

		const own = await preview(target, {});
		expect(own.own_badges.map(({key, hidden}) => [key, hidden])).toEqual([
			['staff', true],
			['partner', false],
			['bug_hunter', true],
			[`custom:${custom.id}`, true],
		]);

		const {users} = await createBuilder<{users: Array<UserAdminResponse>}>(harness, admin.token)
			.get(`/admin/users/${target.userId}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(users[0]!.profile_badges.map(({key, suppressed}) => [key, suppressed])).toEqual([
			['staff', true],
			['partner', false],
			['bug_hunter', true],
			[`custom:${custom.id}`, true],
		]);
	});

	test('an unknown badge key is refused', async () => {
		const account = await createTestAccount(harness);
		await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({hidden_profile_badges: ['not_a_badge']})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
