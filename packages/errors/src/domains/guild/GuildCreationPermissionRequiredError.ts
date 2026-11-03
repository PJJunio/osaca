// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@osaca/errors/src/domains/core/ForbiddenError';

export class GuildCreationPermissionRequiredError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.GUILD_CREATION_PERMISSION_REQUIRED});
	}
}
