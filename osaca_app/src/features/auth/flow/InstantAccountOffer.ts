// SPDX-License-Identifier: AGPL-3.0-or-later

import {InstantAccountAvailability} from '@osaca/constants/src/AccountConfigConstants';
import type {InstanceFeatures} from '@osaca/schema/src/domains/instance/InstanceSchemas';

export function offersInstantAccount(
	features: Pick<InstanceFeatures, 'instant_accounts' | 'instant_account_availability'>,
	registrationUrlCode: string | null,
): boolean {
	const availability =
		features.instant_account_availability ??
		(features.instant_accounts === true ? InstantAccountAvailability.AVAILABLE : InstantAccountAvailability.DISABLED);
	if (availability === InstantAccountAvailability.AVAILABLE) return true;
	return (
		registrationUrlCode !== null &&
		(availability === InstantAccountAvailability.REGISTRATION_CLOSED ||
			availability === InstantAccountAvailability.APPROVAL_REQUIRED)
	);
}
