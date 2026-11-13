// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {fetchMany, fetchOne} from '@app/api/database/CassandraQueryExecution';
import type {UserByAclRow, UserByUsernameRow} from '@app/api/database/types/UserTypes';
import type {User} from '@app/api/models/User';
import {UserByAcl, UserByUsername} from '@app/api/Tables';

const FETCH_USER_IDS_BY_ACL_QUERY = UserByAcl.select({
	columns: ['user_id'],
	where: UserByAcl.where.eq('acl'),
});
const FETCH_DISCRIMINATORS_BY_USERNAME_QUERY = UserByUsername.select({
	columns: ['discriminator', 'user_id'],
	where: UserByUsername.where.eq('username'),
});
const FETCH_USER_ID_BY_USERNAME_DISCRIMINATOR_QUERY = UserByUsername.select({
	columns: ['user_id'],
	where: [UserByUsername.where.eq('username'), UserByUsername.where.eq('discriminator')],
	limit: 1,
});

export class UserLookupRepository {
	constructor(private findUniqueUser: (userId: UserID) => Promise<User | null>) {}

	async findByUsernameDiscriminator(username: string, discriminator: number): Promise<User | null> {
		const usernameLower = username.toLowerCase();
		const result = await fetchOne<Pick<UserByUsernameRow, 'user_id'>>(
			FETCH_USER_ID_BY_USERNAME_DISCRIMINATOR_QUERY.bind({username: usernameLower, discriminator}),
		);
		if (!result) return null;
		return await this.findUniqueUser(result.user_id);
	}

	async findDiscriminatorsByUsername(username: string): Promise<Set<number>> {
		const usernameLower = username.toLowerCase();
		const result = await fetchMany<Pick<UserByUsernameRow, 'discriminator'>>(
			FETCH_DISCRIMINATORS_BY_USERNAME_QUERY.bind({username: usernameLower}),
		);
		return new Set(result.map((r) => r.discriminator));
	}

	async findUsersByUsername(username: string): Promise<Array<User>> {
		const usernameLower = username.toLowerCase();
		const rows = await fetchMany<Pick<UserByUsernameRow, 'discriminator' | 'user_id'>>(
			FETCH_DISCRIMINATORS_BY_USERNAME_QUERY.bind({username: usernameLower}),
		);
		const users = await Promise.all(rows.map((row) => this.findUniqueUser(row.user_id)));
		return users.filter((user): user is User => user !== null);
	}

	async listUserIdsWithAcl(acl: string): Promise<Array<UserID>> {
		const rows = await fetchMany<Pick<UserByAclRow, 'user_id'>>(FETCH_USER_IDS_BY_ACL_QUERY.bind({acl}));
		return rows.map((row) => row.user_id);
	}
}
