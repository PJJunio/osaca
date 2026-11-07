// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	type AppLayoutState,
	type NagbarConditions,
	type NagbarState,
	NagbarType,
} from '@app/features/app/components/layout/app_layout/AppLayoutTypes';
import {
	useInstanceNoticeRefresh,
	useVisibleInstanceNotice,
} from '@app/features/app/components/layout/app_layout/nagbars/InstanceNoticeState';
import {isScheduledMaintenanceNagbarDismissed} from '@app/features/app/components/layout/app_layout/ScheduledMaintenanceDismissal';
import Config from '@app/features/app/config/Config';
import DomainMovedNotice from '@app/features/app/domain_migration/DomainMovedNotice';
import {isClientReconnecting} from '@app/features/app/state/ClientReadiness';
import Initialization from '@app/features/app/state/Initialization';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import Accounts from '@app/features/auth/state/Accounts';
import Authentication from '@app/features/auth/state/Authentication';
import Channels from '@app/features/channel/state/Channels';
import GatewaySessions from '@app/features/gateway/transport/GatewaySessionPool';
import * as NotificationUtils from '@app/features/notification/utils/NotificationUtils';
import StreamerMode from '@app/features/streamer_mode/state/StreamerMode';
import WindowsFont, {WINDOWS_FONT_CHANGED_AT_MS} from '@app/features/theme/state/WindowsFont';
import ThemeSettingsState from '@app/features/theme_settings/state/ThemeSettingsState';
import Nagbar from '@app/features/ui/state/Nagbar';
import {isUnclaimedNagbarSnoozed} from '@app/features/ui/state/UnclaimedNagbarSnooze';
import {hasUnavailableElectronNativeContext, isDesktop, isNativeWindows} from '@app/features/ui/utils/NativeUtils';
import {isStandalonePwa} from '@app/features/ui/utils/PwaUtils';
import StatusPage from '@app/features/user/state/StatusPage';
import Users from '@app/features/user/state/Users';
import MediaEngine, {useVoiceEngineV2Model} from '@app/features/voice/engine/MediaEngineFacade';
import {selectVoiceEngineV2AppConnectionWithFallback} from '@app/features/voice/engine/v2/VoiceEngineV2AppSelectors';
import CallState from '@app/features/voice/state/CallState';
import SoftwareEncoderWarning from '@app/features/voice/state/SoftwareEncoderWarning';
import VoiceSessionRestore from '@app/features/voice/state/VoiceSessionRestore';
import {
	getVoiceSessionRestoreSnapshotKey,
	isRestorableVoiceChannelType,
} from '@app/features/voice/utils/VoiceSessionRestoreUtils';
import {ChannelTypes} from '@osaca/constants/src/ChannelConstants';
import {PRIVACY_POLICY_LAST_UPDATED, TERMS_OF_SERVICE_LAST_UPDATED} from '@osaca/constants/src/PolicyConstants';
import {useEffect, useMemo, useState} from 'react';

function sortNagbarsByPriority(a: NagbarState, b: NagbarState): number {
	return a.priority - b.priority;
}

function selectVisibleNagbars(nagbars: Array<NagbarState>): Array<NagbarState> {
	const visibleNagbars = nagbars.filter((nagbar) => nagbar.visible).sort(sortNagbarsByPriority);
	const pinned = visibleNagbars.filter((nagbar) => nagbar.type === NagbarType.BUILD_ENVIRONMENT);
	const selectable = visibleNagbars.filter((nagbar) => nagbar.type !== NagbarType.BUILD_ENVIRONMENT);
	const nonDismissible = selectable.filter((nagbar) => !nagbar.dismissible);
	const dismissible = selectable.filter((nagbar) => nagbar.dismissible);
	const selectedNonDismissible = nonDismissible.slice(0, 1);
	const selectedDismissible = dismissible.slice(0, 1);
	return [...pinned, ...selectedNonDismissible, ...selectedDismissible].sort(sortNagbarsByPriority);
}

const BUILD_ENVIRONMENT_HIDDEN_RELEASE_CHANNELS = new Set<string>(['stable', 'canary']);

export const useAppLayoutState = (): AppLayoutState => {
	const [isStandalone, setIsStandalone] = useState(isStandalonePwa());
	useEffect(() => {
		const checkStandalone = () => {
			setIsStandalone(isStandalonePwa());
		};
		checkStandalone();
		document.documentElement.classList.toggle('is-standalone', isStandalone);
		return () => {
			document.documentElement.classList.remove('is-standalone');
		};
	}, [isStandalone]);
	return {isStandalone};
};
export const useNagbarConditions = (): NagbarConditions => {
	const voiceEngineV2Model = useVoiceEngineV2Model();
	const user = Users.currentUser;
	const nagbarState = Nagbar;
	const isSelfHosted = RuntimeConfig.isSelfHosted();
	const [startupVoiceSessionRestoreSnapshotKey, setStartupVoiceSessionRestoreSnapshotKey] = useState<
		string | null | undefined
	>(undefined);
	const currentUserId = Authentication.currentUserId;
	const voiceSessionRestoreHydrated = VoiceSessionRestore.isHydrated;
	const voiceSessionRestoreSnapshot = VoiceSessionRestore.getSnapshotForUser(currentUserId);
	const voiceSessionRestoreSnapshotKey = getVoiceSessionRestoreSnapshotKey(voiceSessionRestoreSnapshot);
	const voiceSessionRestoreChannel = voiceSessionRestoreSnapshot
		? Channels.getChannel(voiceSessionRestoreSnapshot.channelId)
		: null;
	const voiceConnectionContext = MediaEngine.connectionContext;
	const voiceEngineV2Connection = selectVoiceEngineV2AppConnectionWithFallback(voiceEngineV2Model, {
		connected: voiceConnectionContext.connected,
		connecting: voiceConnectionContext.connecting,
		reconnecting: voiceConnectionContext.reconnecting,
		guildId: voiceConnectionContext.guildId,
		channelId: voiceConnectionContext.channelId,
		sessionId: voiceConnectionContext.connectionId,
	});
	const shouldShowDesktopNotification = (() => {
		if (isDesktop() || !NotificationUtils.hasNotification()) return false;
		if (typeof Notification !== 'undefined') {
			if (Notification.permission === 'granted') return false;
			if (Notification.permission === 'denied') return false;
		}
		return true;
	})();
	const isNativeDesktop = isDesktop();
	const hasBrokenElectronNativeContext = hasUnavailableElectronNativeContext();
	const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
	const isDesktopBrowser = !isNativeDesktop && !hasBrokenElectronNativeContext && !isMobileDevice;
	const canShowDesktopDownload = (() => {
		if (nagbarState.forceHideDesktopDownload) return false;
		if (nagbarState.forceDesktopDownload) return true;
		return isDesktopBrowser && !nagbarState.desktopDownloadDismissed;
	})();
	const canShowGuildMembershipCta = (() => {
		if (nagbarState.forceHideGuildMembershipCta) return false;
		if (nagbarState.forceGuildMembershipCta) return true;
		if (!user) return false;
		if (isSelfHosted) return false;
		if (user.accountTier !== 'verified') return false;
		return !nagbarState.guildMembershipCtaDismissed;
	})();
	useInstanceNoticeRefresh();
	const canShowInstanceNotice = useVisibleInstanceNotice() !== null;
	void nagbarState.scheduledMaintenanceDismissalVersion;
	const canShowScheduledMaintenance = (() => {
		if (nagbarState.forceHideScheduledMaintenance) return false;
		if (nagbarState.forceScheduledMaintenance) return true;
		const scheduledMaintenance = StatusPage.scheduledMaintenance;
		return Boolean(
			scheduledMaintenance &&
				!isScheduledMaintenanceNagbarDismissed(scheduledMaintenance.id, scheduledMaintenance.status),
		);
	})();
	useEffect(() => {
		if (!voiceSessionRestoreHydrated || !currentUserId || startupVoiceSessionRestoreSnapshotKey !== undefined) {
			return;
		}
		setStartupVoiceSessionRestoreSnapshotKey(voiceSessionRestoreSnapshotKey);
	}, [
		currentUserId,
		voiceSessionRestoreHydrated,
		voiceSessionRestoreSnapshotKey,
		startupVoiceSessionRestoreSnapshotKey,
	]);
	useEffect(() => {
		if (!voiceSessionRestoreHydrated || !currentUserId || !voiceSessionRestoreSnapshot) {
			return;
		}
		if (!voiceSessionRestoreChannel) {
			VoiceSessionRestore.clearSnapshot();
			setStartupVoiceSessionRestoreSnapshotKey(null);
			return;
		}
		if (!isRestorableVoiceChannelType(voiceSessionRestoreChannel.type)) {
			VoiceSessionRestore.clearSnapshot();
			setStartupVoiceSessionRestoreSnapshotKey(null);
		}
	}, [currentUserId, voiceSessionRestoreChannel, voiceSessionRestoreHydrated, voiceSessionRestoreSnapshot]);
	const canShowVoiceSessionRestore = (() => {
		if (nagbarState.forceHideVoiceSessionRestore) return false;
		if (nagbarState.forceVoiceSessionRestore) return true;
		if (!GatewaySessions.foregroundConnection.socket || !Initialization.canNavigateToProtectedRoutes) return false;
		if (!voiceSessionRestoreHydrated || !currentUserId) return false;
		if (!voiceSessionRestoreSnapshot || !voiceSessionRestoreChannel) return false;
		if (voiceEngineV2Connection.connected || voiceEngineV2Connection.connecting) return false;
		if (!isRestorableVoiceChannelType(voiceSessionRestoreChannel.type)) return false;
		if (
			(voiceSessionRestoreChannel.type === ChannelTypes.DM ||
				voiceSessionRestoreChannel.type === ChannelTypes.GROUP_DM) &&
			!CallState.hasActiveCall(voiceSessionRestoreChannel.id)
		) {
			return false;
		}
		return Boolean(
			startupVoiceSessionRestoreSnapshotKey && startupVoiceSessionRestoreSnapshotKey === voiceSessionRestoreSnapshotKey,
		);
	})();
	const canShowSoftwareEncoder = SoftwareEncoderWarning.showWarning;
	const canShowStreamerMode = StreamerMode.shouldShowNagbar;
	const canShowWindowsFont =
		isNativeWindows() &&
		user != null &&
		user.createdAt.getTime() < WINDOWS_FONT_CHANGED_AT_MS &&
		!WindowsFont.useOsacaSans &&
		!WindowsFont.nagbarDismissed;
	let canShowDomainMoved: boolean;
	if (nagbarState.forceHideDomainMoved) {
		canShowDomainMoved = false;
	} else if (nagbarState.forceDomainMoved) {
		canShowDomainMoved = true;
	} else {
		canShowDomainMoved = DomainMovedNotice.shouldShow(Date.now());
	}
	const canShowBuildEnvironment =
		!BUILD_ENVIRONMENT_HIDDEN_RELEASE_CHANNELS.has(Config.RELEASE_CHANNEL) &&
		!nagbarState.buildEnvironmentDismissedThisSession;
	let canShowConnection: boolean;
	if (nagbarState.forceHideConnectionNotice) {
		canShowConnection = false;
	} else if (nagbarState.forceConnectionNotice) {
		canShowConnection = true;
	} else {
		canShowConnection = isClientReconnecting();
	}
	const needsTermsAcceptance = (() => {
		if (!user) return false;
		if (isSelfHosted) return false;
		if (nagbarState.forceHideTermsAcceptance) return false;
		if (nagbarState.forceTermsAcceptance) return true;
		if (TERMS_OF_SERVICE_LAST_UPDATED == null && PRIVACY_POLICY_LAST_UPDATED == null) return false;
		const termsOutdated =
			TERMS_OF_SERVICE_LAST_UPDATED != null &&
			(!user.termsAgreedAt || user.termsAgreedAt.toISOString() < TERMS_OF_SERVICE_LAST_UPDATED);
		const privacyOutdated =
			PRIVACY_POLICY_LAST_UPDATED != null &&
			(!user.privacyAgreedAt || user.privacyAgreedAt.toISOString() < PRIVACY_POLICY_LAST_UPDATED);
		return termsOutdated || privacyOutdated;
	})();
	let canShowCorruptedInstallation: boolean;
	if (nagbarState.forceHideCorruptedInstallation) {
		canShowCorruptedInstallation = false;
	} else if (nagbarState.forceCorruptedInstallation) {
		canShowCorruptedInstallation = true;
	} else {
		canShowCorruptedInstallation = hasBrokenElectronNativeContext;
	}
	let userIsUnclaimed: boolean;
	if (nagbarState.forceHideUnclaimedAccount) {
		userIsUnclaimed = false;
	} else if (nagbarState.forceUnclaimedAccount) {
		userIsUnclaimed = true;
	} else {
		userIsUnclaimed = Boolean(
			!Accounts.isSwitching &&
				user &&
				!user.isClaimed() &&
				!nagbarState.unclaimedAccountDismissedThisSession &&
				!isUnclaimedNagbarSnoozed(user.id),
		);
	}
	let canShowAccountLimited: boolean;
	if (nagbarState.forceHideAccountLimited) {
		canShowAccountLimited = false;
	} else if (nagbarState.forceAccountLimited) {
		canShowAccountLimited = true;
	} else {
		canShowAccountLimited = user?.accountLimited === true;
	}
	let canShowDesktopNotification: boolean;
	if (nagbarState.forceHideDesktopNotification) {
		canShowDesktopNotification = false;
	} else if (nagbarState.forceDesktopNotification) {
		canShowDesktopNotification = true;
	} else {
		canShowDesktopNotification = shouldShowDesktopNotification && !nagbarState.desktopNotificationDismissed;
	}
	return {
		canShowBuildEnvironment,
		canShowConnection,
		canShowCorruptedInstallation,
		canShowScheduledMaintenance,
		canShowInstanceNotice,
		userIsUnclaimed,
		canShowAccountLimited,
		canShowDesktopNotification,
		canShowDesktopDownload,
		canShowGuildMembershipCta,
		canShowVoiceSessionRestore,
		needsTermsAcceptance,
		canShowSoftwareEncoder,
		canShowStreamerMode,
		canShowDomainMoved,
		canShowWindowsFont,
		canShowCustomCssOff: ThemeSettingsState.customCssOff,
	};
};
export const useActiveNagbars = (conditions: NagbarConditions): Array<NagbarState> => {
	return useMemo(() => {
		const nagbars: Array<NagbarState> = [
			{
				type: NagbarType.BUILD_ENVIRONMENT,
				priority: -1000,
				visible: conditions.canShowBuildEnvironment,
				dismissible: true,
			},
			{
				type: NagbarType.CONNECTION,
				priority: -100,
				visible: conditions.canShowConnection,
				dismissible: false,
			},
			{
				type: NagbarType.CORRUPTED_INSTALLATION,
				priority: -10,
				visible: conditions.canShowCorruptedInstallation,
				dismissible: false,
			},
			{
				type: NagbarType.TERMS_ACCEPTANCE,
				priority: -5,
				visible: conditions.needsTermsAcceptance,
				dismissible: false,
			},
			{
				type: NagbarType.SCHEDULED_MAINTENANCE,
				priority: -1,
				visible: conditions.canShowScheduledMaintenance,
				dismissible: true,
			},
			{
				type: NagbarType.INSTANCE_NOTICE,
				priority: -1.5,
				visible: conditions.canShowInstanceNotice,
				dismissible: true,
			},
			{
				type: NagbarType.UNCLAIMED_ACCOUNT,
				priority: -4,
				visible: conditions.userIsUnclaimed,
				dismissible: true,
			},
			{
				type: NagbarType.ACCOUNT_LIMITED,
				priority: -3.75,
				visible: conditions.canShowAccountLimited,
				dismissible: false,
			},
			{
				type: NagbarType.VOICE_SESSION_RESTORE,
				priority: -3.5,
				visible: conditions.canShowVoiceSessionRestore,
				dismissible: true,
			},
			{
				type: NagbarType.GUILD_MEMBERSHIP_CTA,
				priority: 6,
				visible: conditions.canShowGuildMembershipCta,
				dismissible: true,
			},
			{
				type: NagbarType.DESKTOP_NOTIFICATION,
				priority: 8,
				visible: conditions.canShowDesktopNotification,
				dismissible: true,
			},
			{
				type: NagbarType.DESKTOP_DOWNLOAD,
				priority: 9,
				visible: conditions.canShowDesktopDownload,
				dismissible: true,
			},
			{
				type: NagbarType.SOFTWARE_ENCODER,
				priority: -2,
				visible: conditions.canShowSoftwareEncoder,
				dismissible: true,
			},
			{
				type: NagbarType.STREAMER_MODE,
				priority: -2.5,
				visible: conditions.canShowStreamerMode,
				dismissible: true,
			},
			{
				type: NagbarType.DOMAIN_MOVED,
				priority: 3,
				visible: conditions.canShowDomainMoved,
				dismissible: true,
			},
			{
				type: NagbarType.WINDOWS_FONT,
				priority: 4.5,
				visible: conditions.canShowWindowsFont,
				dismissible: true,
			},
			{
				type: NagbarType.CUSTOM_CSS_OFF,
				priority: -2.75,
				visible: conditions.canShowCustomCssOff,
				dismissible: false,
			},
		];
		return selectVisibleNagbars(nagbars);
	}, [conditions]);
};
