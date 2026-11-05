// SPDX-License-Identifier: AGPL-3.0-or-later

import {makePersistent} from '@app/features/platform/utils/MobXPersistence';
import {initializeStore} from '@app/features/platform/utils/StoreInitialization';
import {makeAutoObservable} from 'mobx';

export type DeveloperOptionsState = Readonly<{
	bypassLoadingSkeleton: boolean;
	forceLoadingSkeleton: boolean;
	forceFailMessageSends: boolean;
	forceFailMessageLoads: boolean;
	showMyselfTyping: boolean;
	slowMessageLoad: boolean;
	slowMessageSend: boolean;
	slowProfileLoad: boolean;
	forceProfileSkeletons: boolean;
	forceProfileDataWarning: boolean;
	forceUnknownMessageType: boolean;
	selfHostedModeOverride: boolean;
	forceShowVanityURLDisclaimer: boolean;
	emailVerifiedOverride: boolean | null;
	unclaimedAccountOverride: boolean | null;
	mockVerificationBarrier:
		| 'none'
		| 'unclaimed_account'
		| 'unverified_email'
		| 'account_too_new'
		| 'not_member_long'
		| 'account_limited'
		| 'send_message_disabled';
	mockBarrierTimeRemaining: number | null;
	mockMatureContentGateReason: 'none' | 'geo_restricted' | 'mature_content_check_required' | 'consent_required';
	mockMatureMediaGateReason: 'none' | 'geo_restricted' | 'mature_content_check_required';
	forceMatureMedia: boolean;
	mockInUK: boolean;
	forceNoSendMessages: boolean;
	forceNoAttachFiles: boolean;
	mockSlowmodeActive: boolean;
	mockSlowmodeRemaining: number;
	mockTitlebarPlatformOverride: 'auto' | 'macos' | 'windows' | 'linux';
	mockAttachmentStates: Record<
		string,
		{
			expired?: boolean;
			expiresAt?: string | null;
		}
	>;
	noOpInAppReports: boolean;
	disableTranslationDomGuard: boolean;
}>;
type MutableDeveloperOptionsState = {
	-readonly [K in keyof DeveloperOptionsState]: DeveloperOptionsState[K];
};

class DeveloperOptions implements DeveloperOptionsState {
	bypassLoadingSkeleton = false;
	forceLoadingSkeleton = false;
	forceFailMessageSends = false;
	forceFailMessageLoads = false;
	showMyselfTyping = false;
	slowMessageLoad = false;
	slowMessageSend = false;
	slowProfileLoad = false;
	forceProfileSkeletons = false;
	forceProfileDataWarning = false;
	forceUnknownMessageType = false;
	selfHostedModeOverride = false;
	forceShowVanityURLDisclaimer = false;
	emailVerifiedOverride: boolean | null = null;
	unclaimedAccountOverride: boolean | null = null;
	mockVerificationBarrier:
		| 'none'
		| 'unclaimed_account'
		| 'unverified_email'
		| 'account_too_new'
		| 'not_member_long'
		| 'account_limited'
		| 'send_message_disabled' = 'none';
	mockBarrierTimeRemaining: number | null = null;
	mockMatureContentGateReason: 'none' | 'geo_restricted' | 'mature_content_check_required' | 'consent_required' =
		'none';
	mockMatureMediaGateReason: 'none' | 'geo_restricted' | 'mature_content_check_required' = 'none';
	forceMatureMedia = false;
	mockInUK = false;
	forceNoSendMessages = false;
	forceNoAttachFiles = false;
	mockSlowmodeActive = false;
	mockSlowmodeRemaining = 10000;
	mockAttachmentStates: Record<
		string,
		{
			expired?: boolean;
			expiresAt?: string | null;
		}
	> = {};
	mockTitlebarPlatformOverride: DeveloperOptionsState['mockTitlebarPlatformOverride'] = 'auto';
	noOpInAppReports = false;
	disableTranslationDomGuard = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		initializeStore(this, () => this.initPersistence());
	}

	private async initPersistence(): Promise<void> {
		await makePersistent(this, 'DeveloperOptions', [
			'bypassLoadingSkeleton',
			'forceLoadingSkeleton',
			'forceFailMessageSends',
			'forceFailMessageLoads',
			'showMyselfTyping',
			'slowMessageLoad',
			'slowMessageSend',
			'slowProfileLoad',
			'forceProfileSkeletons',
			'forceProfileDataWarning',
			'forceUnknownMessageType',
			'selfHostedModeOverride',
			'forceShowVanityURLDisclaimer',
			'emailVerifiedOverride',
			'unclaimedAccountOverride',
			'mockVerificationBarrier',
			'mockBarrierTimeRemaining',
			'mockMatureContentGateReason',
			'mockMatureMediaGateReason',
			'forceMatureMedia',
			'mockInUK',
			'forceNoSendMessages',
			'forceNoAttachFiles',
			'mockSlowmodeActive',
			'mockSlowmodeRemaining',
			'mockTitlebarPlatformOverride',
			'mockAttachmentStates',
			'noOpInAppReports',
			'disableTranslationDomGuard',
		]);
	}

	updateOption<K extends keyof DeveloperOptions & keyof DeveloperOptionsState>(
		key: K,
		value: DeveloperOptionsState[K],
	): void {
		(this as MutableDeveloperOptionsState)[key] = value;
	}
}

export default new DeveloperOptions();
