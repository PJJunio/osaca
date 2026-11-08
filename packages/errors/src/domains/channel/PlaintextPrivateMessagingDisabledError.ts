// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class PlaintextPrivateMessagingDisabledError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.PLAINTEXT_PRIVATE_MESSAGING_DISABLED,
			message: 'Plaintext messaging is disabled for private conversations; MLS end-to-end encryption is required.',
		});
	}
}
