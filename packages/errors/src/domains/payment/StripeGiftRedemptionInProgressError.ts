// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {OsacaError} from '@osaca/errors/src/OsacaError';

export class StripeGiftRedemptionInProgressError extends OsacaError {
	constructor() {
		super({
			code: APIErrorCodes.STRIPE_GIFT_REDEMPTION_IN_PROGRESS,
			status: 400,
		});
	}
}
