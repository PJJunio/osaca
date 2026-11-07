// SPDX-License-Identifier: AGPL-3.0-or-later

import {type EmailTextLinks, renderEmailText} from '@pkgs/email/src/email_html/EmailHtmlRenderer';
import {getEmailTemplate} from '@pkgs/email/src/email_i18n/EmailI18n';
import type {EmailTemplateVariables} from '@pkgs/email/src/email_i18n/EmailI18nTypes';
import type {EmailTemplate, EmailTemplateKey} from '@pkgs/email/src/email_i18n/EmailI18nTypes.generated';

type NoticeSlots = Record<string, string | null | undefined>;

type FactRow = readonly [string | undefined, string | null | undefined, string?];

function facts(...rows: Array<FactRow>): NoticeSlots {
	const slots: NoticeSlots = {};
	let count = 0;
	for (const [label, value, url] of rows) {
		if (!label || !value) {
			continue;
		}
		count += 1;
		slots[`fact_${count}_label`] = label;
		if (url) {
			slots[`fact_${count}_link`] = value;
			slots[`fact_${count}_link_url`] = url;
		} else {
			slots[`fact_${count}_value`] = value;
		}
	}
	return slots;
}

export function noticeLinkUrls(config: {marketingBaseUrl: string}): NoticeSlots {
	return {
		dsa_url: `${config.marketingBaseUrl}/help/dsa-dispute-resolution`,
		arn_url: 'https://www.arn.se/',
	};
}

export function enforcementNoticeSlots(
	template: EmailTemplate,
	variables: EmailTemplateVariables['enforcement_notice'],
): NoticeSlots {
	return {
		...facts(
			[template.rule_label, variables.rule_title, variables.rule_url ?? undefined],
			[template.decision_label, variables.decision_id],
		),
		intro: `${template.intro}\n\n${template.effects}`,
		section_1_title: template.why_title,
		section_1_body: template.why_body,
		section_1_note: template.statement,
		section_2_title: template.how_title,
		section_2_body: template.how_body,
		...(template.appeal_body
			? {section_3_title: template.appeal_title, section_3_body: template.appeal_body, section_3_note: template.redress}
			: {}),
	};
}

export function enforcementEndedSlots(template: EmailTemplate): NoticeSlots {
	return {text_1: template.statement, text_2: template.content_removed};
}

export function reportResolvedSlots(template: EmailTemplate, reportId: string, publicComment: string): NoticeSlots {
	return {
		intro: `${template.about}\n${template.intro}`,
		...facts([template.report_label, reportId], [template.comment_label, publicComment]),
		text_1: publicComment ? undefined : template.thanks,
	};
}

export function renderNoticeText<T extends EmailTemplateKey>(
	templateKey: T,
	locale: string | null,
	variables: EmailTemplateVariables[T],
	productName: string,
	slots: (template: EmailTemplate) => NoticeSlots = () => ({}),
	links: {format: EmailTextLinks; urls?: NoticeSlots; reply?: 'yes' | 'no'} = {format: 'plain'},
): string | null {
	const result = getEmailTemplate(templateKey, locale, {...variables, reply: links.reply ?? 'no'}, productName);
	return result.ok ? renderEmailText({...links.urls, ...result.value, ...slots(result.value)}, links.format) : null;
}
