// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';

export function resolveMissingResetTokenRedirect(): string {
	return Routes.RECOVER_ACCOUNT;
}
