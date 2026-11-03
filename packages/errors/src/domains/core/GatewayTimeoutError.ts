// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@osaca/errors/src/OsacaError';

export class GatewayTimeoutError extends defaultCodeStatusError(504, APIErrorCodes.GATEWAY_TIMEOUT) {}
