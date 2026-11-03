// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ConflictError} from '@osaca/errors/src/domains/core/ConflictError';

export class SyncedPreferencesConflictError extends ConflictError {
	constructor() {
		super({
			code: APIErrorCodes.SYNCED_PREFERENCES_CONFLICT,
		});
	}
}
