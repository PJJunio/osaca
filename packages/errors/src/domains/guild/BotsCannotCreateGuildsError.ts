// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class BotsCannotCreateGuildsError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.BOTS_CANNOT_CREATE_GUILDS});
	}
}
