// SPDX-License-Identifier: AGPL-3.0-or-later

import {ResettableStates} from '@app/features/app/state/ResettableStates';
import {initializeStore} from '@app/features/platform/utils/StoreInitialization';
import {makeSyncedField} from '@app/features/user/state/SyncedField';
import {NagbarDismissalsSchema} from '@osaca/schema/src/gen/osaca/user/preferences/v1/preferences_pb';
import {makeAutoObservable} from 'mobx';

interface NagbarSettings {
	iosInstallDismissed: boolean;
	pwaInstallDismissed: boolean;
	pushNotificationDismissed: boolean;
	desktopNotificationDismissed: boolean;
	desktopDownloadDismissed: boolean;
	pendingBulkDeletionDismissed: Record<string, boolean>;
	invitesDisabledDismissed: Record<string, boolean>;
	guildMfaRequirementDismissed: Record<string, boolean>;
	guildMembershipCtaDismissed: boolean;
	forceConnectionNotice: boolean;
	forceAccountLimited: boolean;
	forceUnclaimedAccount: boolean;
	forceDesktopNotification: boolean;
	forceInvitesDisabled: boolean;
	forceDesktopDownload: boolean;
	forceGuildMembershipCta: boolean;
	forceTermsAcceptance: boolean;
	forceCorruptedInstallation: boolean;
	forceScheduledMaintenance: boolean;
	forceVoiceSessionRestore: boolean;
	forceGuildMfaRequirement: boolean;
	forceDomainMoved: boolean;
	forceHideConnectionNotice: boolean;
	forceHideAccountLimited: boolean;
	forceHideUnclaimedAccount: boolean;
	forceHideDesktopNotification: boolean;
	forceHideInvitesDisabled: boolean;
	forceHideDesktopDownload: boolean;
	forceHideGuildMembershipCta: boolean;
	forceHideTermsAcceptance: boolean;
	forceHideCorruptedInstallation: boolean;
	forceHideScheduledMaintenance: boolean;
	forceHideVoiceSessionRestore: boolean;
	forceHideGuildMfaRequirement: boolean;
	forceHideDomainMoved: boolean;
}

export type NagbarToggleKey = Exclude<
	keyof NagbarSettings,
	'guildMfaRequirementDismissed' | 'invitesDisabledDismissed' | 'pendingBulkDeletionDismissed'
>;

export class Nagbar implements NagbarSettings {
	iosInstallDismissed = false;
	pwaInstallDismissed = false;
	pushNotificationDismissed = false;
	desktopNotificationDismissed = false;
	desktopDownloadDismissed = false;
	pendingBulkDeletionDismissed: Record<string, boolean> = {};
	invitesDisabledDismissed: Record<string, boolean> = {};
	guildMfaRequirementDismissed: Record<string, boolean> = {};
	guildMembershipCtaDismissed = false;
	buildEnvironmentDismissedThisSession = false;
	scheduledMaintenanceDismissalVersion = 0;
	unclaimedAccountDismissedThisSession = false;
	forceAccountLimited = false;
	forceUnclaimedAccount = false;
	forceDesktopNotification = false;
	forceInvitesDisabled = false;
	forceDesktopDownload = false;
	forceGuildMembershipCta = false;
	forceTermsAcceptance = false;
	forceCorruptedInstallation = false;
	forceScheduledMaintenance = false;
	forceVoiceSessionRestore = false;
	forceGuildMfaRequirement = false;
	forceDomainMoved = false;
	forceConnectionNotice = false;
	forceHideAccountLimited = false;
	forceHideUnclaimedAccount = false;
	forceHideDesktopNotification = false;
	forceHideInvitesDisabled = false;
	forceHideDesktopDownload = false;
	forceHideGuildMembershipCta = false;
	forceHideTermsAcceptance = false;
	forceHideCorruptedInstallation = false;
	forceHideScheduledMaintenance = false;
	forceHideVoiceSessionRestore = false;
	forceHideGuildMfaRequirement = false;
	forceHideDomainMoved = false;
	forceHideConnectionNotice = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		initializeStore(this, () => this.initPersistence());
	}

	private async initPersistence(): Promise<void> {
		await makeSyncedField(this, {
			field: 'nagbars',
			schema: NagbarDismissalsSchema,
			persist: [
				'iosInstallDismissed',
				'pwaInstallDismissed',
				'pushNotificationDismissed',
				'desktopNotificationDismissed',
				'desktopDownloadDismissed',
				'pendingBulkDeletionDismissed',
				'invitesDisabledDismissed',
				'guildMfaRequirementDismissed',
				'guildMembershipCtaDismissed',
			],
			toMessage: (s) => ({
				iosInstall: s.iosInstallDismissed,
				pwaInstall: s.pwaInstallDismissed,
				pushNotification: s.pushNotificationDismissed,
				desktopNotification: s.desktopNotificationDismissed,
				desktopDownload: s.desktopDownloadDismissed,
				guildMembershipCta: s.guildMembershipCtaDismissed,
				pendingBulkDeletion: {...s.pendingBulkDeletionDismissed},
				invitesDisabled: {...s.invitesDisabledDismissed},
				guildMfaRequirement: {...s.guildMfaRequirementDismissed},
			}),
			applyMessage: (s, m) => {
				s.iosInstallDismissed = m.iosInstall;
				s.pwaInstallDismissed = m.pwaInstall;
				s.pushNotificationDismissed = m.pushNotification;
				s.desktopNotificationDismissed = m.desktopNotification;
				s.desktopDownloadDismissed = m.desktopDownload;
				s.guildMembershipCtaDismissed = m.guildMembershipCta;
				s.pendingBulkDeletionDismissed = {...m.pendingBulkDeletion};
				s.invitesDisabledDismissed = {...m.invitesDisabled};
				s.guildMfaRequirementDismissed = {...m.guildMfaRequirement};
			},
		});
	}

	getInvitesDisabledDismissed(guildId: string): boolean {
		return this.invitesDisabledDismissed[guildId] ?? false;
	}

	getGuildMfaRequirementDismissed(guildId: string): boolean {
		return this.guildMfaRequirementDismissed[guildId] ?? false;
	}

	bumpScheduledMaintenanceDismissed(): void {
		this.scheduledMaintenanceDismissalVersion++;
	}

	dismissBuildEnvironmentNagbar(): void {
		this.buildEnvironmentDismissedThisSession = true;
	}

	dismissUnclaimedAccountForSession(): void {
		this.unclaimedAccountDismissedThisSession = true;
	}

	dismiss(nagbarType: NagbarToggleKey): void {
		this[nagbarType] = true;
	}

	dismissInvitesDisabled(guildId: string): void {
		this.invitesDisabledDismissed = {
			...this.invitesDisabledDismissed,
			[guildId]: true,
		};
	}

	dismissGuildMfaRequirement(guildId: string): void {
		this.guildMfaRequirementDismissed = {
			...this.guildMfaRequirementDismissed,
			[guildId]: true,
		};
	}

	reset(nagbarType: NagbarToggleKey): void {
		this[nagbarType] = false;
	}

	setFlag(key: NagbarToggleKey, value: boolean): void {
		this[key] = value;
	}

	resetSessionDismissals(): void {
		this.unclaimedAccountDismissedThisSession = false;
	}

	resetAll(): void {
		this.iosInstallDismissed = false;
		this.pwaInstallDismissed = false;
		this.pushNotificationDismissed = false;
		this.desktopNotificationDismissed = false;
		this.desktopDownloadDismissed = false;
		this.pendingBulkDeletionDismissed = {};
		this.invitesDisabledDismissed = {};
		this.guildMfaRequirementDismissed = {};
		this.guildMembershipCtaDismissed = false;
		this.buildEnvironmentDismissedThisSession = false;
		this.unclaimedAccountDismissedThisSession = false;
		this.forceAccountLimited = false;
		this.forceUnclaimedAccount = false;
		this.forceDesktopNotification = false;
		this.forceInvitesDisabled = false;
		this.forceDesktopDownload = false;
		this.forceGuildMembershipCta = false;
		this.forceTermsAcceptance = false;
		this.forceCorruptedInstallation = false;
		this.forceScheduledMaintenance = false;
		this.forceVoiceSessionRestore = false;
		this.forceGuildMfaRequirement = false;
		this.forceDomainMoved = false;
		this.forceConnectionNotice = false;
		this.forceHideAccountLimited = false;
		this.forceHideUnclaimedAccount = false;
		this.forceHideDesktopNotification = false;
		this.forceHideInvitesDisabled = false;
		this.forceHideDesktopDownload = false;
		this.forceHideGuildMembershipCta = false;
		this.forceHideTermsAcceptance = false;
		this.forceHideCorruptedInstallation = false;
		this.forceHideScheduledMaintenance = false;
		this.forceHideVoiceSessionRestore = false;
		this.forceHideGuildMfaRequirement = false;
		this.forceHideDomainMoved = false;
		this.forceHideConnectionNotice = false;
	}

	handleGuildUpdate(action: {
		guild: {
			id: string;
			features?: ReadonlyArray<string>;
			properties?: {
				features: ReadonlyArray<string>;
				mfa_level?: number;
			};
			mfa_level?: number;
		};
	}): void {
		const guildId = action.guild.id;
		const features = action.guild.features ?? action.guild.properties?.features;
		if (features != null && !features.includes('INVITES_DISABLED') && this.invitesDisabledDismissed[guildId]) {
			const {[guildId]: _, ...rest} = this.invitesDisabledDismissed;
			this.invitesDisabledDismissed = rest;
		}
		const mfaLevel = action.guild.mfa_level ?? action.guild.properties?.mfa_level;
		if (mfaLevel === 0 && this.guildMfaRequirementDismissed[guildId]) {
			const {[guildId]: _, ...rest} = this.guildMfaRequirementDismissed;
			this.guildMfaRequirementDismissed = rest;
		}
	}
}

const nagbar = new Nagbar();

ResettableStates.register(nagbar, () => nagbar.resetSessionDismissals());

export default nagbar;
