// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ConflictError} from '@osaca/errors/src/domains/core/ConflictError';

export class PaymentDisputeExemptError extends ConflictError {
	constructor(reasons: ReadonlyArray<string>) {
		super({code: APIErrorCodes.PAYMENT_DISPUTE_EXEMPT, data: {reasons: [...reasons]}});
	}
}
