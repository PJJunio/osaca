// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {BadRequestError} from '@osaca/errors/src/domains/core/BadRequestError';

export class WebhookForumTargetConflictError extends BadRequestError {
	constructor() {
		super({
			code: APIErrorCodes.WEBHOOK_FORUM_TARGET_CONFLICT,
		});
	}
}
