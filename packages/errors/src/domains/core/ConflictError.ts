// SPDX-License-Identifier: AGPL-3.0-or-later

import {statusError} from '@osaca/errors/src/OsacaError';

export class ConflictError extends statusError(409) {}
