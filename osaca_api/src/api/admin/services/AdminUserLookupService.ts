// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import {createUserID} from '@app/api/BrandedTypes';
import {isSyntheticUserId} from '@app/api/constants/Core';
import {Logger} from '@app/api/Logger';
import type {User} from '@app/api/models/User';
import {findPersonByLoginHandle, parseLoginHandle} from '@app/api/user/UniqueUsernames';
import type {LookupUserRequest} from '@osaca/schema/src/domains/admin/AdminUserSchemas';

interface AdminUserLookupServiceDeps {
	apiContext: ApiContext;
}

export class AdminUserLookupService {
	constructor(private readonly deps: AdminUserLookupServiceDeps) {}

	async lookupUser(data: LookupUserRequest, acls: ReadonlySet<string>, locale?: string) {
		const {users: userRepository, cache: cacheService} = this.deps.apiContext.services;
		if ('user_ids' in data) {
			const userIds = data.user_ids.map((id) => createUserID(id));
			const users = await userRepository.listUsers(userIds);
			return {
				users: await Promise.all(users.map((user) => mapUserToAdminResponse(user, cacheService, acls, locale))),
			};
		}
		let user = null;
		const query = data.query.trim();
		const osacaTagMatch = query.match(/^(.+)#(\d{1,4})$/);
		if (osacaTagMatch) {
			const username = osacaTagMatch[1];
			const discriminator = parseInt(osacaTagMatch[2], 10);
			user = await userRepository.findByUsernameDiscriminator(username, discriminator);
		} else if (/^\d+$/.test(query)) {
			try {
				const userId = createUserID(BigInt(query));
				user = isSyntheticUserId(userId) ? null : await userRepository.findUnique(userId);
			} catch (error) {
				Logger.debug({query, error}, 'Failed to lookup user by numeric ID, invalid ID format');
				user = null;
			}
		} else {
			user = await this.findPersonByBareUsername(query);
		}
		return {
			users: user ? [await mapUserToAdminResponse(user, cacheService, acls, locale)] : [],
		};
	}

	private async findPersonByBareUsername(query: string): Promise<User | null> {
		const handle = parseLoginHandle(query);
		if (!handle || handle.discriminator !== null) return null;
		return await findPersonByLoginHandle(this.deps.apiContext.services.users, handle);
	}
}
