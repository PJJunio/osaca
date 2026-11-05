// SPDX-License-Identifier: AGPL-3.0-or-later

import {createUserID, type UserID} from '@app/api/BrandedTypes';
import {getConfig} from '@app/api/Config';
import {EMPTY_USER_ROW} from '@app/api/database/types/UserTypes';
import {
	stripAvatarForUser,
	stripBannerForUser,
	userHasAnimatedAvatarEntitlement,
} from '@app/api/infrastructure/AssetEntitlementUtils';
import {InstanceConfigRepository} from '@app/api/instance/InstanceConfigRepository';
import {LimitConfigService} from '@app/api/limits/LimitConfigService';
import {User} from '@app/api/models/User';
import {KVCacheProvider} from '@pkgs/cache/src/providers/KVCacheProvider';
import {MockKVProvider} from '@pkgs/kv_client/src/testing/MockKVProvider';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

let originalSelfHosted = true;

function ensureLimitConfigGlobal(): void {
	new LimitConfigService(
		new InstanceConfigRepository(),
		new KVCacheProvider({client: new MockKVProvider()}),
	).setAsGlobalInstance();
}

function createUser(params: {
	userId: UserID;
	avatarHash: string | null;
	bannerHash?: string | null;
	isBot?: boolean;
}): User {
	return new User({
		...EMPTY_USER_ROW,
		user_id: params.userId,
		username: `user-${params.userId.toString()}`,
		discriminator: 1234,
		avatar_hash: params.avatarHash,
		banner_hash: params.bannerHash ?? null,
		bot: params.isBot ?? false,
		flags: 0n,
		version: 1,
	});
}

describe('AssetEntitlementUtils', () => {
	beforeEach(() => {
		const config = getConfig();
		originalSelfHosted = config.instance.selfHosted;
		config.instance.selfHosted = false;
		ensureLimitConfigGlobal();
	});
	afterEach(() => {
		getConfig().instance.selfHosted = originalSelfHosted;
	});
	describe('stripAvatarForUser', () => {
		test('keeps the a_ prefix under the default limits', () => {
			const user = createUser({userId: createUserID(1n), avatarHash: 'a_abc123'});
			expect(userHasAnimatedAvatarEntitlement(user)).toBe(true);
			expect(stripAvatarForUser(user)).toBe('a_abc123');
		});
		test('leaves a non-animated hash unchanged', () => {
			const user = createUser({userId: createUserID(3n), avatarHash: 'xyz789'});
			expect(stripAvatarForUser(user)).toBe('xyz789');
		});
		test('does not strip for bots (bot avatars are exempt from gating)', () => {
			const botUser = createUser({userId: createUserID(5n), avatarHash: 'a_botanim', isBot: true});
			expect(stripAvatarForUser(botUser)).toBe('a_botanim');
		});
	});
	describe('stripBannerForUser', () => {
		test('keeps a static banner under the default limits', () => {
			const user = createUser({userId: createUserID(8n), avatarHash: null, bannerHash: 'banner123'});
			expect(stripBannerForUser(user)).toBe('banner123');
		});
		test('keeps an animated banner under the default limits', () => {
			const user = createUser({userId: createUserID(9n), avatarHash: null, bannerHash: 'a_banner123'});
			expect(stripBannerForUser(user)).toBe('a_banner123');
		});
	});
});
