// SPDX-License-Identifier: AGPL-3.0-or-later

export type YesNo = 'yes' | 'no';

export type ReporterOutcome = 'removed' | 'restricted' | 'action_taken' | 'no_violation';

export type ReportReferenceTarget = 'message_community' | 'message_dm' | 'message' | 'user' | 'community' | 'other';

export interface ReportReference {
	target: ReportReferenceTarget;
	reportedAt: Date;
	username: string;
	communityName: string;
	channelName: string;
}

export type EnforcementNoticeKindLabel =
	| 'warning'
	| 'suspension'
	| 'ban'
	| 'closure'
	| 'feature_limit'
	| 'content_removal'
	| 'profile_reset'
	| 'community_removal'
	| 'bot';

export interface EmailTemplateVariables {
	enforcement_ended: {
		outcome: 'lifted' | 'reversed';
		decision_id: string | null;
		restores_access: 'yes' | 'no';
		statement: string | null;
		content_removed: 'yes' | 'no';
	};
	enforcement_notice: {
		kind_label: EnforcementNoticeKindLabel;
		neutral: 'yes' | 'no';
		summary: string;
		effects: string;
		rule_title: string;
		rule_url: string | null;
		facts: string;
		statement: string | null;
		how_we_decided: string;
		appeals_email: string | null;
		appeal_deadline: string;
		redress: string | null;
		decision_id: string;
	};
	report_resolved: ReportReference & {
		outcome: ReporterOutcome;
		appeals_email: string | null;
	};
}
