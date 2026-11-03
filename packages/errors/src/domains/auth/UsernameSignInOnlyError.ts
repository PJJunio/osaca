// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class UsernameSignInOnlyError extends BadRequestError {
	constructor() {
		super({code: APIErrorCodes.USERNAME_SIGN_IN_ONLY});
	}
}
