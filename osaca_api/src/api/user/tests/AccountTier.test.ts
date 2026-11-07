// SPDX-License-Identifier: AGPL-3.0-or-later

import {createUserID} from '@app/api/BrandedTypes';
import {EMPTY_USER_ROW, type UserRow} from '@app/api/database/types/UserTypes';
import {setCachedGuildVisitsConfig} from '@app/api/experiment/GuildVisitsGate';
import {hostedAccountsDefaults, setCachedAccountsConfig} from '@app/api/instance/AccountsConfigCache';
import {User} from '@app/api/models/User';
import {WebAuthnCredential} from '@app/api/models/WebAuthnCredential';
import {
	assertTierAllows,
	GUILD_VISITS_CAPABILITY,
	getAccountTier,
	hasWayBackIn,
	NO_TIER_CONTEXT,
	parseTierCapabilities,
	type TierContext,
} from '@app/api/user/AccountTier';
import type {TierGatedAction} from '@osaca/constants/src/AccountTierConstants';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {UserAuthenticatorTypes} from '@osaca/constants/src/UserConstants';
import {OsacaError} from '@osaca/errors/src/OsacaError';
import {GuildVisitsConfigSchema} from '@osaca/schema/src/domains/admin/GuildVisitsSchemas';
import {afterEach, describe, expect, it} from 'vitest';

function createUser(overrides: Partial<UserRow> = {}): User {
	return new User({
		...EMPTY_USER_ROW,
		user_id: createUserID(1n),
		username: 'tier_user',
		discriminator: 0,
		bot: false,
		password_hash: 'hash',
		traits: new Set<string>(),
		...overrides,
	});
}

const UNCLAIMED = createUser({password_hash: null});
const VERIFIED = createUser();

function useInteractionTier(mode: 'legacy' | 'enforced', guildJoinGate: 'visits_capable' | 'always' = 'always') {
	setCachedAccountsConfig({
		...hostedAccountsDefaults().accounts,
		interaction_tier: mode,
		guild_join_gate: guildJoinGate,
	});
}

function useGuildVisits(enabled: boolean): void {
	setCachedGuildVisitsConfig(GuildVisitsConfigSchema.parse({enabled, included_user_ids: enabled ? ['1'] : []}));
}

function reachCode(user: User, action: TierGatedAction, ctx: TierContext = NO_TIER_CONTEXT): string | null {
	try {
		assertTierAllows(user, action, ctx);
		return null;
	} catch (error) {
		if (error instanceof OsacaError) return error.code;
		throw error;
	}
}

const CAPABLE: TierContext = {capabilities: new Set([GUILD_VISITS_CAPABILITY])};

afterEach(() => {
	setCachedAccountsConfig(null);
	setCachedGuildVisitsConfig(null);
});

describe('getAccountTier', () => {
	it('decides by whether the account has a password or passkey', () => {
		expect(getAccountTier(UNCLAIMED)).toBe('unclaimed');
		expect(getAccountTier(VERIFIED)).toBe('verified');
		expect(
			getAccountTier(
				createUser({password_hash: null, authenticator_types: new Set([UserAuthenticatorTypes.WEBAUTHN])}),
			),
		).toBe('verified');
		expect(getAccountTier(createUser({password_hash: null, traits: new Set(['passkey'])}))).toBe('verified');
	});

	it('treats bots and system accounts as verified', () => {
		expect(getAccountTier(createUser({password_hash: null, bot: true}))).toBe('verified');
		expect(getAccountTier(createUser({password_hash: null, system: true}))).toBe('verified');
	});
});

describe('guild join gate', () => {
	it('keeps joining open while the visit rollout does not cover the account', () => {
		useInteractionTier('enforced');
		useGuildVisits(false);
		expect(reachCode(UNCLAIMED, 'guild_join', CAPABLE)).toBeNull();
	});

	it('keeps joining open for a client that cannot visit when the gate is limited to visit clients', () => {
		useInteractionTier('enforced', 'visits_capable');
		useGuildVisits(true);
		expect(reachCode(UNCLAIMED, 'guild_join', NO_TIER_CONTEXT)).toBeNull();
	});

	it('refuses joining for a visit capable client in the rollout', () => {
		useInteractionTier('enforced');
		useGuildVisits(true);
		expect(reachCode(UNCLAIMED, 'guild_join', CAPABLE)).toBe(APIErrorCodes.ACCOUNT_VERIFICATION_REQUIRED);
		expect(reachCode(VERIFIED, 'guild_join', CAPABLE)).toBeNull();
	});

	it('refuses joining for every client by default', () => {
		useInteractionTier('enforced');
		useGuildVisits(true);
		expect(reachCode(UNCLAIMED, 'guild_join', NO_TIER_CONTEXT)).toBe(APIErrorCodes.ACCOUNT_VERIFICATION_REQUIRED);
	});

	it('stays open in legacy mode', () => {
		useInteractionTier('legacy', 'always');
		useGuildVisits(true);
		expect(reachCode(UNCLAIMED, 'guild_join', CAPABLE)).toBeNull();
	});

	it('parses only known capabilities', () => {
		expect(parseTierCapabilities('guild_visits, other')).toEqual(new Set([GUILD_VISITS_CAPABILITY]));
		expect(parseTierCapabilities('Guild_Visits')).toEqual(new Set([GUILD_VISITS_CAPABILITY]));
		expect(parseTierCapabilities(undefined).size).toBe(0);
		expect(parseTierCapabilities('x'.repeat(600)).size).toBe(0);
	});
});

describe('hasWayBackIn', () => {
	function deps(credentials: Array<WebAuthnCredential> = []) {
		return {
			users: {
				listWebAuthnCredentials: async () => credentials,
			},
		};
	}

	it('counts a password and a stored passkey', async () => {
		expect(await hasWayBackIn(deps(), VERIFIED)).toBe(true);
		const credential = new WebAuthnCredential({
			user_id: UNCLAIMED.id,
			credential_id: 'stored-passkey',
			public_key: Buffer.from([1, 2, 3]),
			counter: 0n,
			transports: new Set(['internal']),
			name: 'Passkey',
			created_at: new Date(0),
			last_used_at: null,
			version: 1,
			rp_id: 'example.com',
			superseded_by: null,
		});
		expect(await hasWayBackIn(deps([credential]), UNCLAIMED)).toBe(true);
	});

	it('finds no way back for an account without credentials', async () => {
		expect(await hasWayBackIn(deps(), UNCLAIMED)).toBe(false);
	});

	it('counts the passkey trait without reading stored credentials', async () => {
		const passkeyOnly = createUser({password_hash: null, traits: new Set(['passkey'])});
		const users = {
			listWebAuthnCredentials: async () => {
				throw new Error('should not be read');
			},
		};
		expect(await hasWayBackIn({users}, passkeyOnly)).toBe(true);
	});
});
