// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
import {isPremiumTieringActive} from '@app/api/limits/InstancePremiumModeCache';
import {getCustomBadgeCatalog, getInstanceConfigRepository} from '@app/api/middleware/ServiceSingletons';
import type {ProfileBadgeEnvironment} from '@app/api/user/profile_badges/ProfileBadgeRegistry';
import {CustomBadgeTypes} from '@osaca/constants/src/BadgeConstants';

const HOSTED_PRODUCT_NAME = 'OSACA';
const HOSTED_PREMIUM_NAME = 'Plutonium';

export async function loadProfileBadgeEnvironment(customBadgeIds: Iterable<bigint>): Promise<ProfileBadgeEnvironment> {
	const selfHosted = Config.instance.selfHosted;
	const instanceConfigRepository = getInstanceConfigRepository();
	const [appPublic, customBadges, builtInImages] = await Promise.all([
		instanceConfigRepository.getAppPublicConfig(),
		getCustomBadgeCatalog().getByIds(customBadgeIds, CustomBadgeTypes.USER),
		instanceConfigRepository.getBuiltInBadgeImages(),
	]);
	return {
		selfHosted,
		premiumTieringActive: isPremiumTieringActive(),
		productName: selfHosted ? appPublic.branding.product_name : HOSTED_PRODUCT_NAME,
		premiumName: selfHosted ? appPublic.branding.premium_product_name : HOSTED_PREMIUM_NAME,
		premiumInfoUrl: selfHosted ? appPublic.branding.premium_info_url : null,
		marketingUrl: Config.endpoints.marketing,
		mediaUrl: Config.endpoints.media,
		customBadges,
		builtInImages,
	};
}
