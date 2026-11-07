// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ApiContext} from '@app/api/ApiContext';
import {createApplicationID, createUserID, type UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {EnforcementDecisionRow, EnforcementNoticeChannel} from '@app/api/database/types/EnforcementTypes';
import type {EnforcementNoticeRecord} from '@app/api/enforcement/EnforcementDecisionRepository';
import {
	buildEnforcementNotice,
	type EvidenceMessageLocation,
	isBotDecision,
} from '@app/api/enforcement/EnforcementNotice';
import {getInstanceProductName} from '@app/api/instance/ProductName';
import {Logger} from '@app/api/Logger';
import type {User} from '@app/api/models/User';
import type {ApplicationRepository} from '@app/api/oauth/repositories/ApplicationRepository';
import {
	type SystemDmDeps,
	systemDmBody,
	systemDmsHidden,
	trySendSystemDm,
} from '@app/api/user/services/SystemDmMessage';
import {ENFORCEMENT_REASONS, isAccountKind} from '@osaca/constants/src/EnforcementReasons';
import type {EnforcementNotice} from '@osaca/schema/src/domains/auth/EnforcementNoticeSchemas';
import type {EmailTemplateVariables, EnforcementNoticeKindLabel} from '@pkgs/email/src/email_i18n/EmailI18nTypes';
import {
	enforcementEndedSlots,
	enforcementNoticeSlots,
	noticeLinkUrls,
	renderNoticeText as renderNoticeTemplate,
} from '@pkgs/email/src/NoticeText';

interface EnforcementNoticeDeliveryDeps {
	apiContext: ApiContext;
	applicationRepository: ApplicationRepository;
	systemDm: SystemDmDeps;
}

function sendsSystemDm(decision: EnforcementDecisionRow): boolean {
	return !isAccountKind(decision.kind) || isBotDecision(decision);
}

const NO_SENTENCE_SPACE = /^(ja|zh)\b/i;

function joinSentences(lines: ReadonlyArray<string>, locale: string | null): string {
	return lines.join(NO_SENTENCE_SPACE.test(locale ?? '') ? '' : ' ');
}

function joinParagraphs(lines: ReadonlyArray<string>): string {
	return lines.join('\n');
}

function ruleTitle(rule: EnforcementNotice['rule']): string {
	if (!rule) return '';
	return rule.url ? `[${rule.title}](${rule.url})` : rule.title;
}

function kindLabel(decision: EnforcementDecisionRow, notice: EnforcementNotice): EnforcementNoticeKindLabel {
	if (isBotDecision(decision)) return 'bot';
	return notice.permanent ? 'ban' : decision.kind;
}

function noticeVariables(
	decision: EnforcementDecisionRow,
	notice: EnforcementNotice,
	locale: string | null,
): EmailTemplateVariables['enforcement_notice'] {
	const {handling} = ENFORCEMENT_REASONS[decision.reason_code];
	return {
		kind_label: kindLabel(decision, notice),
		neutral: handling === 'restricted' ? 'yes' : 'no',
		summary: notice.summary,
		effects: joinSentences(notice.effects, locale),
		rule_title: ruleTitle(notice.rule),
		rule_url: null,
		facts: joinParagraphs(notice.facts),
		statement: notice.statement,
		how_we_decided: joinSentences(notice.how_we_decided, locale),
		appeals_email: notice.appeal?.email ?? null,
		appeal_deadline: notice.appeal?.deadline ?? '',
		redress: notice.redress.length > 0 ? joinSentences(notice.redress, locale) : null,
		decision_id: decision.decision_id.toString(),
	};
}

function renderNotice(variables: EmailTemplateVariables['enforcement_notice'], locale: string | null): string | null {
	return renderNoticeTemplate(
		'enforcement_notice',
		locale,
		variables,
		getInstanceProductName(),
		(template) => enforcementNoticeSlots(template, variables),
		{format: 'markdown', urls: noticeLinkUrls({marketingBaseUrl: Config.endpoints.marketing})},
	);
}

export function renderNoticeText(
	decision: EnforcementDecisionRow,
	notice: EnforcementNotice,
	locale: string | null,
): string | null {
	const rendered = renderNotice(noticeVariables(decision, notice, locale), locale);
	return rendered === null ? null : systemDmBody(rendered);
}

export class EnforcementNoticeDelivery {
	constructor(private readonly deps: EnforcementNoticeDeliveryDeps) {}

	async findRecipient(decision: EnforcementDecisionRow): Promise<User | null> {
		const {users} = this.deps.apiContext.services;
		if (decision.recipient_user_id === null) return null;
		return users.findUnique(createUserID(decision.recipient_user_id));
	}

	async findBotOwner(botUserId: UserID): Promise<UserID | null> {
		const application = await this.deps.applicationRepository.getApplication(createApplicationID(BigInt(botUserId)));
		return application?.botUserId === botUserId ? application.ownerUserId : null;
	}

	async deliver(
		decision: EnforcementDecisionRow,
		evidence: ReadonlyArray<EvidenceMessageLocation>,
		networksBlockedUntil: Date | null,
	): Promise<EnforcementNoticeRecord | null> {
		const recipient = await this.findRecipient(decision);
		const systemDm = sendsSystemDm(decision) && !(await systemDmsHidden());
		if (!recipient) {
			return {status: 'undelivered', channels: new Set(), locale: null, text: null, sentAt: null};
		}
		const sentAt = new Date();
		const notice = buildEnforcementNotice(
			{
				type: 'decision',
				decision: {...decision, notice_sent_at: sentAt},
				evidence,
				networksBlockedUntil,
			},
			recipient.locale,
		);
		const dmText = renderNoticeText(decision, notice, recipient.locale);
		if (dmText === null) {
			Logger.error({decisionId: decision.decision_id.toString()}, 'Failed to render an enforcement notice');
			return null;
		}
		if (!systemDm) {
			return {status: 'undelivered', channels: new Set(), locale: recipient.locale, text: dmText, sentAt: null};
		}
		if (!(await this.sendSystemDm(recipient, dmText))) return null;
		return {
			status: 'sent',
			channels: new Set<EnforcementNoticeChannel>(['system_dm']),
			locale: recipient.locale,
			text: dmText,
			sentAt,
		};
	}

	async deliverEnded(
		decision: EnforcementDecisionRow,
		outcome: EmailTemplateVariables['enforcement_ended']['outcome'],
		inForce: boolean,
	): Promise<void> {
		const recipient = await this.findRecipient(decision);
		if (!recipient) return;
		const variables: EmailTemplateVariables['enforcement_ended'] = {
			outcome,
			decision_id: decision.decision_id.toString(),
			restores_access: inForce && isAccountKind(decision.kind) ? 'yes' : 'no',
			statement: decision.end_statement,
			content_removed:
				decision.kind === 'community_removal' ||
				(decision.removed_message_count ?? 0) > 0 ||
				decision.removed_all_messages
					? 'yes'
					: 'no',
		};
		await this.sendEnded(recipient, variables, sendsSystemDm(decision));
	}

	async sendLegacyEnded(recipient: User): Promise<void> {
		await this.sendEnded(
			recipient,
			{
				outcome: 'lifted',
				decision_id: null,
				restores_access: 'yes',
				statement: null,
				content_removed: 'no',
			},
			false,
		);
	}

	private async sendEnded(
		recipient: User,
		variables: EmailTemplateVariables['enforcement_ended'],
		systemDm: boolean,
	): Promise<void> {
		if (!systemDm) return;
		const rendered = renderNoticeTemplate(
			'enforcement_ended',
			recipient.locale,
			variables,
			getInstanceProductName(),
			enforcementEndedSlots,
			{format: 'markdown'},
		);
		if (rendered !== null) {
			await this.sendSystemDm(recipient, systemDmBody(rendered));
		}
	}

	private sendSystemDm(recipient: User, content: string): Promise<boolean> {
		return trySendSystemDm(this.deps.systemDm, this.deps.apiContext.services.users, recipient.id, content);
	}
}
