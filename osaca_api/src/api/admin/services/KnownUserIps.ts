// SPDX-License-Identifier: AGPL-3.0-or-later

import type {User} from '@app/api/models/User';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';

export async function collectKnownUserIps(_userRepository: UserRepository, _user: User): Promise<ReadonlySet<string>> {
	return new Set();
}
