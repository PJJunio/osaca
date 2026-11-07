// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import * as AuthPassword from '@app/api/auth/AuthPassword';
import {emitActivity} from '@app/api/infrastructure/activity/ActivityEvents';
import type {User} from '@app/api/models/User';
import {getAccountTier} from '@app/api/user/AccountTier';
import {mapUserToPrivateResponse} from '@app/api/user/UserMappers';
import {hashPassword} from '@app/api/utils/PasswordUtils';
import {AccountTiers} from '@osaca/constants/src/AccountTierConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {AccountAlreadyClaimedError} from '@osaca/errors/src/domains/auth/AccountAlreadyClaimedError';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import type {ClaimAccountResponse} from '@osaca/schema/src/domains/user/AccountSchemas';

export async function claimAccount(
	ctx: ApiContext,
	params: {user: User; password: string},
): Promise<ClaimAccountResponse> {
	const {user, password} = params;
	if (getAccountTier(user) !== AccountTiers.UNCLAIMED) throw new AccountAlreadyClaimedError();
	if (await AuthPassword.isPasswordPwned(ctx, password)) {
		throw InputValidationError.fromCode('password', ValidationErrorCodes.PASSWORD_IS_TOO_COMMON);
	}
	const updated = await ctx.services.users.patchUpsert(
		user.id,
		{password_hash: await hashPassword(password), password_last_changed_at: new Date()},
		user.toRow(),
	);
	const response = mapUserToPrivateResponse(updated);
	await ctx.services.gateway.dispatchPresence({userId: updated.id, event: 'USER_UPDATE', data: response});
	void emitActivity('account_claimed', updated.id.toString(), {user_id: updated.id.toString(), with_password: true});
	return {user: response};
}
