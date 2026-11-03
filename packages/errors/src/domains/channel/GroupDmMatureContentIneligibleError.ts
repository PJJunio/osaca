// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class GroupDmMatureContentIneligibleError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.GROUP_DM_MATURE_CONTENT_INELIGIBLE,
		});
	}
}
