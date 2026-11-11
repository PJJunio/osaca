import {extractMessageTemplatePlaceholders} from '@osaca/i18n/src/runtime/MessageCatalogTypes';
import {getEmailTemplate} from '@pkgs/email/src/email_i18n/EmailI18n';
import {EMAIL_I18N_LOCALE_MESSAGES} from '@pkgs/email/src/email_i18n/EmailI18nLocales';
import {EMAIL_I18N_MESSAGES} from '@pkgs/email/src/email_i18n/EmailI18nMessages';
import type {EmailTemplateVariables} from '@pkgs/email/src/email_i18n/EmailI18nTypes';
import type {EmailTemplate, EmailTemplateKey} from '@pkgs/email/src/email_i18n/EmailI18nTypes.generated';
import {describe, expect, it} from 'vitest';

const LOCALES = Object.keys(EMAIL_I18N_LOCALE_MESSAGES) as Array<keyof typeof EMAIL_I18N_LOCALE_MESSAGES>;
const TEMPLATE_KEYS = Object.keys(EMAIL_I18N_MESSAGES) as Array<EmailTemplateKey>;
const DATE = new Date('2026-10-01T23:30:00Z');

const FIXTURE: {[K in EmailTemplateKey]: EmailTemplateVariables[K]} = {
	enforcement_ended: {
		outcome: 'reversed',
		decision_id: '123',
		restores_access: 'yes',
		statement: 'We checked again',
		content_removed: 'no',
	},
	enforcement_notice: {
		kind_label: 'suspension',
		neutral: 'no',
		summary: 'We suspended your account.',
		effects: 'You cannot sign in.',
		rule_title: 'Spam',
		rule_url: 'https://example.com/guidelines',
		facts: 'We found spam.',
		statement: null,
		how_we_decided: 'A person decided.',
		appeals_email: 'appeals@osaca.example',
		appeal_deadline: 'Dec 1, 2026',
		redress: null,
		decision_id: '123',
	},
	report_resolved: {
		outcome: 'restricted',
		appeals_email: 'appeals@osaca.example',
		target: 'message_community',
		reportedAt: DATE,
		username: 'example',
		communityName: 'OSACA HQ',
		channelName: 'general',
	},
};

function withReply<K extends EmailTemplateKey>(key: K): EmailTemplateVariables[K] {
	return {...FIXTURE[key], reply: 'yes'} as EmailTemplateVariables[K];
}

describe('EmailI18n locale files', () => {
	it.each(LOCALES)('%s has the same template fields as the source catalog', (locale) => {
		const messages: Partial<Record<EmailTemplateKey, EmailTemplate>> = EMAIL_I18N_LOCALE_MESSAGES[locale];
		for (const key of TEMPLATE_KEYS) {
			expect(Object.keys(messages[key] ?? {}).sort(), key).toEqual(Object.keys(EMAIL_I18N_MESSAGES[key]).sort());
		}
	});
	it.each(LOCALES)('%s keeps the source placeholders in every template field', (locale) => {
		const messages: Partial<Record<EmailTemplateKey, EmailTemplate>> = EMAIL_I18N_LOCALE_MESSAGES[locale];
		for (const key of TEMPLATE_KEYS) {
			const source: EmailTemplate = EMAIL_I18N_MESSAGES[key];
			const translated = messages[key];
			expect(translated, key).toBeDefined();
			if (!translated) continue;
			for (const field of Object.keys(source)) {
				expect(extractMessageTemplatePlaceholders(translated[field] ?? ''), `${key}.${field}`).toEqual(
					extractMessageTemplatePlaceholders(source[field]),
				);
			}
		}
	});
	it.each(LOCALES)('%s keeps every link tag of the source in every template field', (locale) => {
		const messages: Partial<Record<EmailTemplateKey, EmailTemplate>> = EMAIL_I18N_LOCALE_MESSAGES[locale];
		const tags = (text: string) => (text.match(/<\/?(mail|settings|dsa|arn|labs)>/g) ?? []).sort();
		for (const key of TEMPLATE_KEYS) {
			const source: EmailTemplate = EMAIL_I18N_MESSAGES[key];
			for (const [field, text] of Object.entries(source)) {
				const translated = messages[key]?.[field] ?? '';
				expect(tags(translated), `${key}.${field}`).toEqual(tags(text));
				expect(translated, `${key}.${field}`).not.toMatch(
					/<(mail|settings|dsa|arn|labs)>[^<]*<(mail|settings|dsa|arn|labs)>/,
				);
			}
		}
	});
	it.each(['en-US', ...LOCALES])('%s renders every template with UTC times', (locale) => {
		for (const key of TEMPLATE_KEYS) {
			const result = getEmailTemplate(key, locale, withReply(key), 'OSACA');
			expect(result.ok, key).toBe(true);
			if (!result.ok) continue;
			for (const [field, text] of Object.entries(result.value)) {
				expect(text, `${key}.${field}`).not.toContain('GMT');
				expect(text, `${key}.${field}`).not.toContain('Coordinated Universal Time');
			}
		}
	});
});
