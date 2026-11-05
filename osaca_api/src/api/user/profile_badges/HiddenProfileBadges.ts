// SPDX-License-Identifier: AGPL-3.0-or-later

import {customBadgeIdFromProfileBadgeKey, type ProfileBadgeKey} from '@osaca/constants/src/BadgeConstants';

export interface HiddenProfileBadgeChanges {
	hidden_profile_badges?: Array<ProfileBadgeKey>;
}

export function resolveHiddenProfileBadges(changes: HiddenProfileBadgeChanges): Set<ProfileBadgeKey> | null {
	return changes.hidden_profile_badges === undefined ? null : new Set(changes.hidden_profile_badges);
}

export function hiddenCustomBadgeIds(hidden: ReadonlySet<ProfileBadgeKey>): Array<string> {
	return [...hidden].flatMap((key) => {
		const id = customBadgeIdFromProfileBadgeKey(key);
		return id === null ? [] : [id];
	});
}

export function dropUndefinedCustomBadgeKeys(
	hidden: ReadonlySet<ProfileBadgeKey>,
	userBadgeIds: ReadonlySet<string>,
): Set<ProfileBadgeKey> {
	return new Set(
		[...hidden].filter((key) => {
			const id = customBadgeIdFromProfileBadgeKey(key);
			return id === null || userBadgeIds.has(id);
		}),
	);
}
