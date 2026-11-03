// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {OsacaError} from '@osaca/errors/src/OsacaError';

export class StripeBillingCycleChangeNeedsResubscribeError extends OsacaError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_BILLING_CYCLE_CHANGE_NEEDS_RESUBSCRIBE,
			status: 400,
		});
	}
}
