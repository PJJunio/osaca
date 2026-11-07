// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {statusError} from '@osaca/errors/src/OsacaError';

export class KeyPackageExhaustedError extends statusError(404) {
	constructor(deviceId?: string) {
		super({
			code: APIErrorCodes.MLS_KEY_PACKAGE_EXHAUSTED,
			message: deviceId ? `No key packages available for device ${deviceId}` : 'No key packages available for device',
			data: deviceId ? {device_id: deviceId} : undefined,
		});
	}
}
