// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';

const AUTO_REDIRECT_EXEMPT_PATHS = new Set<string>([Routes.RESET_PASSWORD, Routes.OAUTH_AUTHORIZE]);
const AUTO_REDIRECT_EXEMPT_PREFIXES = ['/invite/', '/gift/', '/theme/', '/oauth2/'];
export const isAutoRedirectExemptPath = (pathname: string): boolean => {
	if (AUTO_REDIRECT_EXEMPT_PATHS.has(pathname)) {
		return true;
	}
	return AUTO_REDIRECT_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};
