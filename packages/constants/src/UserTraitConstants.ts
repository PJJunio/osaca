// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ValueOf} from '@osaca/constants/src/ValueOf';

export const UserTraits = {
	SSO: 'sso',
	PASSKEY: 'passkey',
} as const;

export type UserTrait = ValueOf<typeof UserTraits>;

export type UserTraitSet = ReadonlySet<string> | ReadonlyArray<string>;

export function hasUserTrait(traits: UserTraitSet, trait: UserTrait): boolean {
	return 'has' in traits ? traits.has(trait) : traits.includes(trait);
}
