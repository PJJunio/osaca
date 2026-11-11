// SPDX-License-Identifier: AGPL-3.0-or-later

export type EmailTemplateKey =
	| 'enforcement_ended'
	| 'enforcement_notice'
	| 'report_resolved';

export interface EmailTemplate {
	subject: string;
	intro: string;
	[field: string]: string;
}
