// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class MaxUsersPerMessageReactionError extends BadRequestError {
	constructor(limit: number) {
		super({
			code: APIErrorCodes.MAX_REACTIONS,
			messageVariables: {count: limit},
		});
	}
}
