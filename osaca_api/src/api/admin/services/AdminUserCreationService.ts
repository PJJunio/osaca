// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {mapUserToAdminResponse} from '@app/api/admin/models/UserTypes';
import type {AdminAuditService} from '@app/api/admin/services/AdminAuditService';
import type {AdminUserSecurityService} from '@app/api/admin/services/AdminUserSecurityService';
import {resolveRegistrationUsername} from '@app/api/auth/AuthRegistration';
import {createUserID, type UserID} from '@app/api/BrandedTypes';
import {EMPTY_USER_ROW, type UserRow} from '@app/api/database/types/UserTypes';
import {emitActivity} from '@app/api/infrastructure/activity/ActivityEvents';
import type {DiscriminatorService} from '@app/api/infrastructure/DiscriminatorService';
import type {User} from '@app/api/models/User';
import {UserSettings} from '@app/api/models/UserSettings';
import {reserveUsername, type UsernameReservation} from '@app/api/user/UniqueUsernames';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {ProfileFieldPrivacyFlags} from '@osaca/constants/src/UserConstants';
import type {AdminUserCreateRequest, AdminUserCreateResponse} from '@osaca/schema/src/domains/admin/AdminUserSchemas';

interface AdminUserCreationServiceDeps {
	apiContext: ApiContext;
	auditService: AdminAuditService;
	discriminatorService: DiscriminatorService;
	securityService: AdminUserSecurityService;
}

export class AdminUserCreationService {
	constructor(private readonly deps: AdminUserCreationServiceDeps) {}

	async createUser(
		data: AdminUserCreateRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
		acls: ReadonlySet<string>,
	): Promise<AdminUserCreateResponse> {
		const {cache} = this.deps.apiContext.services;
		const user = await this.createAccount(data);
		await this.deps.auditService.createAuditLog({
			adminUserId,
			targetType: 'user',
			targetId: BigInt(user.id),
			action: 'create_user',
			auditLogReason,
			metadata: new Map([
				['username', user.username],
				['admin', String(data.admin)],
			]),
		});
		const passwordReset = await this.deps.securityService.createPasswordResetLink(
			{user_id: user.id},
			adminUserId,
			auditLogReason,
			acls,
		);
		return {
			user: await mapUserToAdminResponse(user, cache, acls),
			password_reset: passwordReset,
		};
	}

	private async createAccount(data: AdminUserCreateRequest): Promise<User> {
		const {users, snowflake, cache} = this.deps.apiContext.services;
		const {username, discriminator} = await resolveRegistrationUsername({
			users,
			discriminatorService: this.deps.discriminatorService,
			uniqueUsernames: true,
			requestedUsername: data.username,
			explicitlyRequested: true,
			globalName: undefined,
		});
		const userId = createUserID(await snowflake.generate());
		const now = new Date();
		const traits = new Set<string>();
		const userRow: UserRow = {
			...EMPTY_USER_ROW,
			user_id: userId,
			username,
			discriminator,
			global_name: null,
			bot: false,
			system: false,
			password_hash: null,
			password_last_changed_at: null,
			authenticator_types: new Set(),
			timezone_privacy_flags: ProfileFieldPrivacyFlags.EVERYONE,
			flags: 0n,
			terms_agreed_at: null,
			privacy_agreed_at: null,
			last_active_at: now,
			acls: data.admin ? new Set([AdminACLs.WILDCARD]) : null,
			traits: traits.size > 0 ? traits : null,
			version: 1,
		};
		let reservation: UsernameReservation | null = null;
		let user: User;
		try {
			reservation = await reserveUsername({users, cache}, username);
			user = await users.create(userRow);
		} finally {
			await reservation?.release();
		}
		await users.upsertSettings(UserSettings.getDefaultUserSettings({userId, locale: 'en-US', isAdult: true}));
		await emitActivity(
			'registration',
			user.id.toString(),
			{
				user_id: user.id.toString(),
				method: 'other',
				source: 'app',
				username,
				username_user_chosen: true,
				global_name: null,
				locale: user.locale,
				timezone: null,
				invite_code: null,
				flags: user.flags.toString(),
			},
			null,
			user.id.toString(),
		);
		return user;
	}
}
