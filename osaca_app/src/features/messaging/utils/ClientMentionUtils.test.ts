// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {extractClientMentions} from './ClientMentionUtils';

describe('ClientMentionUtils', () => {
	it('extracts single user mention', () => {
		const res = extractClientMentions('Hello <@123456789>, how are you?');
		expect(res.mentions).toHaveLength(1);
		expect(res.mentions[0].id).toBe('123456789');
		expect(res.mention_everyone).toBe(false);
		expect(res.mention_roles).toEqual([]);
	});

	it('extracts nickname mention with exclamation mark', () => {
		const res = extractClientMentions('Look at this <@!987654321>!');
		expect(res.mentions).toHaveLength(1);
		expect(res.mentions[0].id).toBe('987654321');
	});

	it('deduplicates multiple mentions of the same user', () => {
		const res = extractClientMentions('<@111> hey <@111> check <@!111>');
		expect(res.mentions).toHaveLength(1);
		expect(res.mentions[0].id).toBe('111');
	});

	it('detects @everyone and @here', () => {
		const res1 = extractClientMentions('Hey @everyone wake up');
		expect(res1.mention_everyone).toBe(true);

		const res2 = extractClientMentions('Hey @here listen');
		expect(res2.mention_everyone).toBe(true);

		const res3 = extractClientMentions('someone@here.com');
		expect(res3.mention_everyone).toBe(false);
	});

	it('extracts role mentions', () => {
		const res = extractClientMentions('Calling <@&55555> and <@&66666>');
		expect(res.mention_roles).toEqual(['55555', '66666']);
	});
});
