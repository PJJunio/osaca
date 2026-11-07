// SPDX-License-Identifier: AGPL-3.0-or-later

import type {User} from '@app/api/models/User';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';

interface RecentUserIp {
	ip: string;
	lastSeenAt: Date;
}

export async function collectKnownUserIps(_userRepository: UserRepository, _user: User): Promise<ReadonlySet<string>> {
	return new Set();
}

export async function listRecentUserIps(
	_userRepository: UserRepository,
	_user: User,
	_since: Date,
): Promise<Array<RecentUserIp>> {
	return [];
}
