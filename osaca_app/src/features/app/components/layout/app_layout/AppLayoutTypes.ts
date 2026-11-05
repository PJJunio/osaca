// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ValueOf} from '@osaca/constants/src/ValueOf';

export const NagbarType = {
	BUILD_ENVIRONMENT: 'build-environment',
	CONNECTION: 'connection',
	CORRUPTED_INSTALLATION: 'corrupted-installation',
	SCHEDULED_MAINTENANCE: 'scheduled-maintenance',
	INSTANCE_NOTICE: 'instance-notice',
	UNCLAIMED_ACCOUNT: 'unclaimed-account',
	EMAIL_VERIFICATION: 'email-verification',
	ACCOUNT_LIMITED: 'account-limited',
	DESKTOP_NOTIFICATION: 'desktop-notification',
	DESKTOP_DOWNLOAD: 'desktop-download',
	GUILD_MEMBERSHIP_CTA: 'guild-membership-cta',
	VOICE_SESSION_RESTORE: 'voice-session-restore',
	TERMS_ACCEPTANCE: 'terms-acceptance',
	SOFTWARE_ENCODER: 'software-encoder',
	STREAMER_MODE: 'streamer-mode',
	DOMAIN_MOVED: 'domain-moved',
	WINDOWS_FONT: 'windows-font',
	CUSTOM_CSS_OFF: 'custom-css-off',
} as const;

export type NagbarType = ValueOf<typeof NagbarType>;

export interface NagbarState {
	type: NagbarType;
	priority: number;
	visible: boolean;
	dismissible: boolean;
}

export interface AppLayoutState {
	isStandalone: boolean;
}

export interface NagbarConditions {
	canShowBuildEnvironment: boolean;
	canShowConnection: boolean;
	canShowCorruptedInstallation: boolean;
	canShowScheduledMaintenance: boolean;
	canShowInstanceNotice: boolean;
	userIsUnclaimed: boolean;
	userNeedsVerification: boolean;
	canShowAccountLimited: boolean;
	canShowDesktopNotification: boolean;
	canShowDesktopDownload: boolean;
	canShowGuildMembershipCta: boolean;
	canShowVoiceSessionRestore: boolean;
	needsTermsAcceptance: boolean;
	canShowSoftwareEncoder: boolean;
	canShowStreamerMode: boolean;
	canShowDomainMoved: boolean;
	canShowWindowsFont: boolean;
	canShowCustomCssOff: boolean;
}
