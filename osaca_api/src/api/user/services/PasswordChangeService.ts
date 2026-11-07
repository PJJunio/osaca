// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import * as AuthPassword from '@app/api/auth/AuthPassword';
import type {User} from '@app/api/models/User';
import {hashPassword} from '@app/api/utils/PasswordUtils';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';

export class PasswordChangeService {
	constructor(private readonly apiContext: ApiContext) {}

	async setPassword(user: User, newPassword: string): Promise<User> {
		const {users} = this.apiContext.services;
		if (await AuthPassword.isPasswordPwned(this.apiContext, newPassword)) {
			throw InputValidationError.fromCode('new_password', ValidationErrorCodes.PASSWORD_IS_TOO_COMMON);
		}
		const newPasswordHash = await hashPassword(newPassword);
		return await users.patchUpsert(
			user.id,
			{
				password_hash: newPasswordHash,
				password_last_changed_at: new Date(),
			},
			user.toRow(),
		);
	}
}
