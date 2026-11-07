// SPDX-License-Identifier: AGPL-3.0-or-later

import type {Account} from '@app/features/platform/state/AuthSession';
import {formatUserTag} from '@app/features/user/utils/UserTagUtils';

export function accountSignInIdentifier(account: Account): string | null {
	const userData = account.userData;
	if (userData == null) {
		return null;
	}
	return formatUserTag(userData);
}
