// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {statusError} from '@osaca/errors/src/OsacaError';

export class EpochConflictError extends statusError(409) {
	constructor(data?: {current_epoch: number; requested_epoch: number}) {
		super({
			code: APIErrorCodes.MLS_EPOCH_CONFLICT,
			message: data
				? `MLS epoch conflict: current epoch is ${data.current_epoch}, but commit requested epoch ${data.requested_epoch}`
				: 'MLS epoch conflict',
			data,
		});
	}
}
