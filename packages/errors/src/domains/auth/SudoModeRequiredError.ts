// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ForbiddenError} from '@osaca/errors/src/domains/core/ForbiddenError';

export interface SudoModeMethods {
	totp: boolean;
	webauthn: boolean;
	backup_codes: boolean;
	password: boolean;
}

const EMPTY_METHODS: SudoModeMethods = {
	totp: false,
	webauthn: false,
	backup_codes: false,
	password: false,
};

export class SudoModeRequiredError extends ForbiddenError {
	constructor(hasMfa: boolean, methods: SudoModeMethods = EMPTY_METHODS) {
		super({
			code: APIErrorCodes.SUDO_MODE_REQUIRED,
			data: {
				has_mfa: hasMfa,
				methods,
			},
		});
	}
}
