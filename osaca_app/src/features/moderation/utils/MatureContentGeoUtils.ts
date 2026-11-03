// SPDX-License-Identifier: AGPL-3.0-or-later

import DeveloperOptions from '@app/features/devtools/state/DeveloperOptions';

interface MatureContentGeoContext {
	countryCode: string | null;
	regionCode: string | null;
}

export function getEffectiveMatureContentGeoContext(): MatureContentGeoContext {
	if (DeveloperOptions.mockInUK) {
		return {countryCode: 'GB', regionCode: null};
	}
	return {countryCode: null, regionCode: null};
}
