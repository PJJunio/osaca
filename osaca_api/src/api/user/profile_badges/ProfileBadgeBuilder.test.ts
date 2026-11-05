// SPDX-License-Identifier: AGPL-3.0-or-later

import {CONTENT_I18N_LOCALE_MESSAGES} from '@app/api/content_i18n/ContentI18nLocales';
import {CONTENT_I18N_MESSAGES} from '@app/api/content_i18n/ContentI18nMessages';
import {
	buildProfileBadges,
	type ProfileBadgeInput,
	type ProfileBadgeSubject,
} from '@app/api/user/profile_badges/ProfileBadgeBuilder';
import type {ProfileBadgeEnvironment} from '@app/api/user/profile_badges/ProfileBadgeRegistry';
import type {ProfileBadgeKey} from '@osaca/constants/src/BadgeConstants';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {describe, expect, test} from 'vitest';

const HOSTED: ProfileBadgeEnvironment = {
	selfHosted: false,
	productName: 'OSACA',
	marketingUrl: 'https://osaca.example',
	mediaUrl: 'https://media.osaca.example',
	customBadges: [],
	builtInImages: {},
};

function subject(overrides: Partial<ProfileBadgeSubject> = {}): ProfileBadgeSubject {
	return {
		flags: 0n,
		badgeIds: new Set(),
		hiddenProfileBadges: new Set(),
		...overrides,
	};
}

function build(overrides: Partial<ProfileBadgeInput> = {}) {
	return buildProfileBadges({
		user: subject(),
		locale: 'en-US',
		environment: HOSTED,
		...overrides,
	});
}

const kinds = (overrides: Partial<ProfileBadgeInput> = {}) => build(overrides).map((badge) => badge.kind);

const everything = subject({flags: UserFlags.STAFF | UserFlags.PARTNER | UserFlags.BUG_HUNTER});

describe('buildProfileBadges', () => {
	test('a hidden key drops the badge it names', () => {
		const hide = (...keys: Array<ProfileBadgeKey>) => new Set(keys);
		expect(kinds({user: everything})).toEqual(['staff', 'partner', 'bug_hunter']);
		expect(kinds({user: {...everything, hiddenProfileBadges: hide('staff', 'bug_hunter')}})).toEqual(['partner']);
	});

	test('restricted profiles keep the flag badges', () => {
		expect(kinds({user: everything, restricted: true})).toEqual(['staff', 'partner', 'bug_hunter']);
	});

	test('hidden accounts show nothing', () => {
		expect(build({user: everything, profileHidden: true})).toEqual([]);
	});

	describe('localization', () => {
		test('every profile badge key is translated and keeps its variables in every locale', () => {
			const keys = Object.keys(CONTENT_I18N_MESSAGES).filter((key) => key.startsWith('profile_badge.'));
			expect(keys.length).toBeGreaterThan(0);
			const variables = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
			for (const [locale, messages] of Object.entries(CONTENT_I18N_LOCALE_MESSAGES)) {
				for (const key of keys) {
					const template = (messages as Record<string, string | undefined>)[key];
					expect(template, `${locale} ${key}`).toBeTypeOf('string');
					expect(variables(template!), `${locale} ${key}`).toEqual(
						variables(CONTENT_I18N_MESSAGES[key as keyof typeof CONTENT_I18N_MESSAGES]),
					);
				}
			}
		});

		test('every locale renders every badge without falling back to the key', () => {
			for (const locale of Object.keys(CONTENT_I18N_LOCALE_MESSAGES)) {
				for (const badge of build({user: everything, locale})) {
					expect(badge.label.startsWith('profile_badge.'), `${locale} ${badge.kind}`).toBe(false);
				}
			}
		});
	});
});
