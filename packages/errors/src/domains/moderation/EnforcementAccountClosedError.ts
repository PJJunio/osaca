// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ConflictError} from '@osaca/errors/src/domains/core/ConflictError';

export class EnforcementAccountClosedError extends ConflictError {
	constructor() {
		super({code: APIErrorCodes.ENFORCEMENT_ACCOUNT_CLOSED});
	}
}
