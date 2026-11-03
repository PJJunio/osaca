// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {NotFoundError} from '@osaca/errors/src/domains/core/NotFoundError';

export class UnknownEnforcementDecisionError extends NotFoundError {
	constructor() {
		super({code: APIErrorCodes.UNKNOWN_ENFORCEMENT_DECISION});
	}
}
