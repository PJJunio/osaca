// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class MaxBadgesError extends BadRequestError {
	constructor(params: {maxBadges: number}) {
		const {maxBadges} = params;
		super({
			code: APIErrorCodes.MAX_BADGES,
			messageVariables: {count: maxBadges},
			data: {max_badges: maxBadges},
		});
	}
}
