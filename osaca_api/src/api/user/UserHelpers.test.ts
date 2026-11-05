// SPDX-License-Identifier: AGPL-3.0-or-later

import {canOwnerRunBots, isSignInRefused, isTemporarilyBanned} from '@app/api/user/UserHelpers';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {describe, expect, it} from 'vitest';

describe('account standing', () => {
	const hour = 3_600_000;
	function standing(flags: bigint, tempBannedUntil: Date | null = null, deletionStartedAt: Date | null = null) {
		return {flags, tempBannedUntil, deletionStartedAt};
	}
	it('treats an active temporary ban as a refused sign-in', () => {
		const banned = standing(UserFlags.DISABLED, new Date(Date.now() + hour));
		expect(isTemporarilyBanned(banned)).toBe(true);
		expect(isSignInRefused(banned)).toBe(true);
		expect(canOwnerRunBots(banned)).toBe(false);
	});
	it('lets an expired temporary ban through', () => {
		const expired = standing(UserFlags.DISABLED, new Date(Date.now() - hour));
		expect(isTemporarilyBanned(expired)).toBe(false);
		expect(isSignInRefused(expired)).toBe(false);
		expect(canOwnerRunBots(expired)).toBe(true);
	});
	it('keeps a self-disabled account able to sign in but stops its bots', () => {
		const disabled = standing(UserFlags.DISABLED);
		expect(isSignInRefused(disabled)).toBe(false);
		expect(canOwnerRunBots(disabled)).toBe(false);
	});
	it('refuses closed accounts', () => {
		expect(isSignInRefused(standing(UserFlags.DELETED))).toBe(true);
		expect(isSignInRefused(standing(0n, null, new Date()))).toBe(true);
		expect(canOwnerRunBots(standing(UserFlags.DELETED))).toBe(false);
	});
	it('accepts an account in good standing', () => {
		expect(isSignInRefused(standing(0n))).toBe(false);
		expect(canOwnerRunBots(standing(0n))).toBe(true);
	});
});
