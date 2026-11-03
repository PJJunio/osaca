// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@osaca/errors/src/domains/core/ForbiddenError';

export class UnclaimedAccountCannotSendMessagesError extends ForbiddenError {
	constructor() {
		super({code: APIErrorCodes.UNCLAIMED_ACCOUNT_CANNOT_SEND_MESSAGES});
	}
}
