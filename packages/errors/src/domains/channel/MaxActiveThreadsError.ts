// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class MaxActiveThreadsError extends BadRequestError {
	constructor(limit: number) {
		super({
			code: APIErrorCodes.MAX_ACTIVE_THREADS,
			messageVariables: {count: limit},
			data: {
				max_active_threads: limit,
			},
		});
	}
}
