// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@osaca/errors/src/domains/core/ForbiddenError';
import type {EnforcementNotice} from '@osaca/schema/src/domains/auth/EnforcementNoticeSchemas';

export class AccountTemporarilySuspendedError extends ForbiddenError {
	constructor(notice: EnforcementNotice) {
		super({code: APIErrorCodes.ACCOUNT_SUSPENDED_TEMPORARILY, data: {notice}});
	}
}
