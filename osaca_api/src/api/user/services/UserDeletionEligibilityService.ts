// SPDX-License-Identifier: AGPL-3.0-or-later

import type {User} from '@app/api/models/User';
import {isTemporarilyBanned} from '@app/api/user/UserHelpers';

export class UserDeletionEligibilityService {
	async isProtectedFromSystemDeletion(user: User): Promise<boolean> {
		return isTemporarilyBanned(user);
	}
}
