// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {OsacaError} from '@osaca/errors/src/OsacaError';

export class SearchIndexNotReadyError extends OsacaError {
	constructor(retryAfterSeconds: number) {
		super({
			code: APIErrorCodes.SEARCH_INDEX_NOT_READY,
			status: 202,
			data: {
				documents_indexed: 0,
				retry_after: retryAfterSeconds,
			},
		});
	}
}
