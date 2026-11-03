// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@osaca/errors/src/domains/core/ForbiddenError';

export class MissingACLError extends ForbiddenError {
	constructor(requiredACL: string) {
		super({
			code: APIErrorCodes.MISSING_ACL,
			messageVariables: {requiredACL},
		});
	}
}
