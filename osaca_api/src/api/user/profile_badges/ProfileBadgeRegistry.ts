// SPDX-License-Identifier: AGPL-3.0-or-later

import {getContentMessage} from '@app/api/content_i18n/ContentI18n';
import type {CustomBadge} from '@app/api/instance/custom_badges/CustomBadgeRepository';
import type {BuiltInBadgeImages} from '@app/api/instance/InstanceConfigRepository';
import {PROFILE_BADGE_ASSETS} from '@app/api/user/profile_badges/ProfileBadgeAssets';
import type {ProfileBadgeKind} from '@osaca/constants/src/BadgeConstants';
import {UserFlags} from '@osaca/constants/src/UserConstants';

export interface ProfileBadgeEnvironment {
	selfHosted: boolean;
	productName: string;
	marketingUrl: string;
	mediaUrl: string;
	customBadges: ReadonlyArray<Pick<CustomBadge, 'id' | 'name' | 'description' | 'asset' | 'href'>>;
	builtInImages: BuiltInBadgeImages;
}

export interface ProfileBadgeView {
	flags: bigint;
	environment: ProfileBadgeEnvironment;
	locale: string;
	shown: ReadonlySet<ProfileBadgeKind>;
}

interface ProfileBadgeContent {
	label: string;
	count?: number;
	accessibleLabel?: string;
	details?: {title: string; lines: Array<string>};
	caption?: string;
	asset?: string | null;
	smallAsset?: string | null;
	aspectRatio?: number;
}

export interface ProfileBadgeDefinition {
	kind: ProfileBadgeKind;
	asset: string | null;
	availability: 'everywhere' | 'hosted' | 'self_hosted';
	href(environment: ProfileBadgeEnvironment): string | null;
	qualify(view: ProfileBadgeView): ProfileBadgeContent | null;
}

function flagBadge(flag: bigint, label: (view: ProfileBadgeView) => string): ProfileBadgeDefinition['qualify'] {
	return (view) => ((view.flags & flag) !== 0n ? {label: label(view)} : null);
}

const marketing = (path: string) => (environment: ProfileBadgeEnvironment) => `${environment.marketingUrl}/${path}`;

export const PROFILE_BADGE_REGISTRY: ReadonlyArray<ProfileBadgeDefinition> = [
	{
		kind: 'staff',
		asset: PROFILE_BADGE_ASSETS.staff,
		availability: 'everywhere',
		href: (environment) => (environment.selfHosted ? null : marketing('careers')(environment)),
		qualify: flagBadge(UserFlags.STAFF, (view) =>
			getContentMessage('profile_badge.staff', view.locale, {product_name: view.environment.productName}),
		),
	},
	{
		kind: 'partner',
		asset: PROFILE_BADGE_ASSETS.partner,
		availability: 'hosted',
		href: marketing('partners'),
		qualify: flagBadge(UserFlags.PARTNER, (view) =>
			getContentMessage('profile_badge.partner', view.locale, {product_name: view.environment.productName}),
		),
	},
	{
		kind: 'bug_hunter',
		asset: PROFILE_BADGE_ASSETS.bug_hunter,
		availability: 'hosted',
		href: () => 'https://www.youtube.com/watch?v=ez8m4PXksQs',
		qualify: flagBadge(UserFlags.BUG_HUNTER, (view) =>
			getContentMessage('profile_badge.bug_hunter', view.locale, {product_name: view.environment.productName}),
		),
	},
];
