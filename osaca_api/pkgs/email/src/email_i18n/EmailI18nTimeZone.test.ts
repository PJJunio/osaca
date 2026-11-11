// SPDX-License-Identifier: AGPL-3.0-or-later

import {getEmailTemplate} from '@pkgs/email/src/email_i18n/EmailI18n';
import {describe, expect, it} from 'vitest';

function render<T extends Parameters<typeof getEmailTemplate>[0]>(
	key: T,
	locale: string,
	variables: Parameters<typeof getEmailTemplate<T>>[2],
	timeZone: string | null,
) {
	const result = getEmailTemplate(key, locale, variables, 'OSACA', timeZone);
	expect(result.ok).toBe(true);
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

const REPORT = {
	outcome: 'restricted',
	appeals_email: null,
	reply: 'no',
	target: 'other',
	reportedAt: new Date('2026-10-01T23:30:00Z'),
	username: 'example',
	communityName: 'OSACA HQ',
	channelName: 'general',
} as const;

describe('email dates and times', () => {
	it('writes dates in UTC when the recipient has no time zone', () => {
		expect(render('report_resolved', 'en-US', REPORT, null).about).toContain('October 1, 2026');
	});

	it('writes dates in the recipient time zone', () => {
		expect(render('report_resolved', 'en-US', REPORT, 'Asia/Tokyo').about).toContain('October 2, 2026');
	});
});
