// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class OperatorPassWaitlistTokenInvalidError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.OPERATOR_PASS_WAITLIST_TOKEN_INVALID});
	}
}
