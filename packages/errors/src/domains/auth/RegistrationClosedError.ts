// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@osaca/errors/src/domains/core/ForbiddenError';

export class RegistrationClosedError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.REGISTRATION_CLOSED});
		this.name = 'RegistrationClosedError';
	}
}
