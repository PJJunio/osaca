// SPDX-License-Identifier: AGPL-3.0-or-later

import {statusError} from '@osaca/errors/src/OsacaError';

export class InternalServerError extends statusError(500, false) {}
