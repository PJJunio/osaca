// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class VoiceJoinEndpointInvalidError extends BadRequestError {
	constructor(detail: string) {
		super({code: APIErrorCodes.VOICE_JOIN_ENDPOINT_INVALID, data: {detail}});
	}
}
