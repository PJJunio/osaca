// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class MediaMetadataError extends BadRequestError {
	constructor(source: string) {
		super({
			code: APIErrorCodes.MEDIA_METADATA_ERROR,
			messageVariables: {source},
		});
	}
}
