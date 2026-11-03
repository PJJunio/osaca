// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {defaultCodeStatusError} from '@osaca/errors/src/OsacaError';

export class SsoProviderUnavailableError extends defaultCodeStatusError(503, APIErrorCodes.SSO_PROVIDER_UNAVAILABLE) {}
