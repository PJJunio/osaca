// SPDX-License-Identifier: AGPL-3.0-or-later

import {isServerManagedTrait, resolveAssignedTraits} from '@app/api/user/UserTraits';
import {describe, expect, it} from 'vitest';

describe('UserTraits', () => {
	it('recognises every trait shape the server manages', () => {
		expect(isServerManagedTrait('registration_pending_approval')).toBe(true);
		expect(isServerManagedTrait('registration_rejected')).toBe(true);
		expect(isServerManagedTrait('beta-tester')).toBe(false);
	});

	it('keeps the operator traits it was given', () => {
		expect([...resolveAssignedTraits([], ['beta-tester', 'experimental'])]).toEqual(['beta-tester', 'experimental']);
	});

	it('preserves server managed traits the operator did not send', () => {
		const resolved = resolveAssignedTraits(
			['passkey', 'registration_pending_approval', 'beta-tester'],
			['experimental'],
		);
		expect([...resolved].sort()).toEqual(['experimental', 'passkey', 'registration_pending_approval']);
	});

	it('keeps a pending approval user pending when their traits are cleared', () => {
		expect([...resolveAssignedTraits(['registration_pending_approval'], [])]).toEqual([
			'registration_pending_approval',
		]);
	});

	it('refuses to let an operator forge a server managed trait', () => {
		expect([...resolveAssignedTraits([], ['passkey', 'registration_rejected'])]).toEqual([]);
	});

	it('ignores empty trait names', () => {
		expect([...resolveAssignedTraits([], ['', 'beta-tester'])]).toEqual(['beta-tester']);
	});
});
