// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {BatchBuilder} from '@app/api/database/CassandraQueryExecution';
import type {UserRow} from '@app/api/database/types/UserTypes';
import {UserByAcl, UserByUsername} from '@app/api/Tables';

export class UserIndexRepository {
	async syncIndices(data: UserRow, oldData?: UserRow | null): Promise<void> {
		const batch = new BatchBuilder();
		const acls = new Set(data.acls ?? []);
		for (const acl of acls) {
			batch.addPrepared(UserByAcl.upsertAll({acl, user_id: data.user_id}));
		}
		for (const acl of oldData?.acls ?? []) {
			if (!acls.has(acl)) {
				batch.addPrepared(UserByAcl.deleteByPk({acl, user_id: data.user_id}));
			}
		}
		if (data.username && data.discriminator != null && data.discriminator !== undefined) {
			batch.addPrepared(
				UserByUsername.upsertAll({
					username: data.username.toLowerCase(),
					discriminator: data.discriminator,
					user_id: data.user_id,
				}),
			);
		}
		if (oldData?.username && oldData.discriminator != null && oldData.discriminator !== undefined) {
			if (
				oldData.username.toLowerCase() !== data.username?.toLowerCase() ||
				oldData.discriminator !== data.discriminator
			) {
				batch.addPrepared(
					UserByUsername.deleteByPk({
						username: oldData.username.toLowerCase(),
						discriminator: oldData.discriminator,
						user_id: oldData.user_id,
					}),
				);
			}
		}
		await batch.execute();
	}

	async indexAcls(userId: UserID, acls: ReadonlySet<string>): Promise<void> {
		const batch = new BatchBuilder();
		for (const acl of acls) {
			batch.addPrepared(UserByAcl.upsertAll({acl, user_id: userId}));
		}
		await batch.execute();
	}

	async updateLastActiveIpIndex(
		_userId: UserID,
		_lastActiveIp: string,
		_lastActiveAt: Date,
		_previousLastActiveIp?: string | null,
	): Promise<void> {}

	async deleteIndices(
		userId: UserID,
		username: string,
		discriminator: number,
		_lastActiveIp?: string | null,
		acls?: ReadonlySet<string> | null,
	): Promise<void> {
		const batch = new BatchBuilder();
		for (const acl of acls ?? []) {
			batch.addPrepared(UserByAcl.deleteByPk({acl, user_id: userId}));
		}
		batch.addPrepared(
			UserByUsername.deleteByPk({
				username: username.toLowerCase(),
				discriminator: discriminator,
				user_id: userId,
			}),
		);
		await batch.execute();
	}
}
