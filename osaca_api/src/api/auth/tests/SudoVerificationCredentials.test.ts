// SPDX-License-Identifier: AGPL-3.0-or-later

import {hasNoVerifiableCredential, userHasMfa, userHasSudoCapability} from '@app/api/auth/services/SudoMethods';
import {createUserID} from '@app/api/BrandedTypes';
import {EMPTY_USER_ROW, type UserRow} from '@app/api/database/types/UserTypes';
import {User} from '@app/api/models/User';
import {UserAuthenticatorTypes} from '@osaca/constants/src/UserConstants';
import {describe, expect, it} from 'vitest';

function createUser(overrides: Partial<UserRow> = {}): User {
	return new User({
		...EMPTY_USER_ROW,
		user_id: createUserID(1n),
		username: 'test_user',
		discriminator: 1,
		bot: false,
		password_hash: 'hash',
		traits: new Set<string>(),
		...overrides,
	});
}

describe('sudo verification credential capability', () => {
	it('still lets an unclaimed account satisfy sudo mode', () => {
		const user = createUser({password_hash: null});
		expect(hasNoVerifiableCredential(user, userHasMfa(user), false)).toBe(true);
	});

	it('still requires a password from accounts that have one', () => {
		const user = createUser({password_hash: 'hash', traits: new Set<string>()});
		expect(hasNoVerifiableCredential(user, userHasMfa(user), false)).toBe(false);
	});

	it('still requires MFA from a passwordless account that enrolled a second factor', () => {
		const user = createUser({
			password_hash: null,
			traits: new Set<string>(),
			authenticator_types: new Set<number>([UserAuthenticatorTypes.TOTP]),
		});
		expect(userHasMfa(user)).toBe(true);
		expect(hasNoVerifiableCredential(user, userHasMfa(user), false)).toBe(false);
	});

	it('never applies to bots', () => {
		const user = createUser({password_hash: null, bot: true});
		expect(hasNoVerifiableCredential(user, userHasMfa(user), false)).toBe(false);
	});

	it('still requires MFA from a passwordless account holding a passkey it never made a second factor', () => {
		const user = createUser({password_hash: null, traits: new Set<string>()});
		expect(userHasMfa(user)).toBe(false);
		expect(userHasSudoCapability(user, true)).toBe(true);
		expect(hasNoVerifiableCredential(user, userHasMfa(user), true)).toBe(false);
	});

	it('still requires MFA from an unclaimed account holding a passkey', () => {
		const user = createUser({password_hash: null});
		expect(hasNoVerifiableCredential(user, userHasMfa(user), true)).toBe(false);
	});

	it('reports no sudo capability for an account with a TOTP secret that was never enrolled', () => {
		const user = createUser({totp_secret: 'JBSWY3DPEHPK3PXP'});
		expect(userHasSudoCapability(user, false)).toBe(false);
	});

	it('reports sudo capability from an enrolled TOTP secret without any passkey', () => {
		const user = createUser({
			totp_secret: 'JBSWY3DPEHPK3PXP',
			authenticator_types: new Set<number>([UserAuthenticatorTypes.TOTP]),
		});
		expect(userHasSudoCapability(user, false)).toBe(true);
	});
});
