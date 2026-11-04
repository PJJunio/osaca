// SPDX-License-Identifier: AGPL-3.0-or-later

import {getErrorMessageUnsafe} from '@osaca/errors/src/i18n/ErrorI18n';
import {ERROR_I18N_LOCALE_MESSAGES} from '@osaca/errors/src/i18n/ErrorI18nLocales';
import {describe, expect, it} from 'vitest';

describe('ErrorI18n global IP block messages', () => {
	const HOSTED = {
		ipAddress: '203.0.113.20',
		appealEmail: 'support@osaca.example',
		expiresAt: 'Jan 12, 2027, 9:00 AM UTC',
		reason: 'none',
		product_name: 'OSACA',
	};
	const SELF_HOSTED = {...HOSTED, appealEmail: null, product_name: 'chat.example.org'};

	it('names the instance and no mailbox in any locale when there is no appeal address', () => {
		for (const locale of Object.keys(ERROR_I18N_LOCALE_MESSAGES)) {
			for (const code of ['GLOBAL_IP_BANNED', 'GLOBAL_IP_TEMPORARILY_BANNED']) {
				const neutral = getErrorMessageUnsafe(code, locale, SELF_HOSTED);
				expect(neutral, `${locale} ${code}`).not.toMatch(/@|\bnull\b|\{/);
				expect(neutral, `${locale} ${code}`).toContain('chat.example.org');
				expect(neutral, `${locale} ${code}`).not.toContain('OSACA');
				const hosted = getErrorMessageUnsafe(code, locale, HOSTED);
				expect(hosted, `${locale} ${code}`).toContain('support@osaca.example');
				expect(hosted, `${locale} ${code}`).toContain('203.0.113.20');
				expect(hosted, `${locale} ${code}`).toContain('OSACA');
			}
		}
	});
});
