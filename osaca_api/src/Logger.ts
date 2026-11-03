// SPDX-License-Identifier: AGPL-3.0-or-later

import {createLogger, type Logger as OsacaLogger} from '@osaca/logger/src/Logger';

export const Logger = createLogger('osaca-api');

export type Logger = OsacaLogger;
