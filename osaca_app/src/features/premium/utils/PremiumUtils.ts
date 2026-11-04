// SPDX-License-Identifier: AGPL-3.0-or-later

import {DEFAULT_PREMIUM_PRODUCT_NAME, PRODUCT_NAME} from '@app/features/app/config/ProductConstants';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import DeveloperOptions from '@app/features/devtools/state/DeveloperOptions';

export function getPremiumProductName(): string {
	return (
		RuntimeConfig.getSnapshotOrNull()?.appPublic.branding.premium_product_name?.trim() || DEFAULT_PREMIUM_PRODUCT_NAME
	);
}

export function getPremiumProductFullName(): string {
	const productName = RuntimeConfig.getSnapshotOrNull()?.appPublic.branding.product_name?.trim() || PRODUCT_NAME;
	return `${productName} ${getPremiumProductName()}`;
}

export function shouldShowPremiumFeatures(): boolean {
	if (DeveloperOptions.selfHostedModeOverride) {
		return false;
	}
	return !RuntimeConfig.isSelfHosted() || RuntimeConfig.premiumEnabled;
}
