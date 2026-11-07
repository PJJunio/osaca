// SPDX-License-Identifier: AGPL-3.0-or-later

import {ATTACH_FILES_PERMISSION, SEND_MESSAGES_PERMISSION} from '@app/features/app/config/I18nDisplayConstants';
import {
	ACTIVE_DESCRIPTOR,
	type ActiveOverrideEntry,
	CUSTOM_VALUE_DESCRIPTOR,
	ENABLED_DESCRIPTOR,
	FORCED_OFF_DESCRIPTOR,
	humanizeDeveloperStateKey,
	nonEmptyText,
	translateDescriptor,
	USE_ACTUAL_VALUE_DESCRIPTOR,
	USE_DEFAULT_DESCRIPTOR,
} from '@app/features/channel/components/channel_header_components/developer_tools/DeveloperToolsShared';
import {formatDurationMs} from '@app/features/channel/components/channel_header_components/developer_tools/FormatHelpers';
import {
	DEVELOPER_OPTION_KEYS,
	isDeveloperOptionAtDefault,
	resetDeveloperOption,
} from '@app/features/channel/components/channel_header_components/developer_tools/ResetOptions';
import type {DeveloperOptionsState} from '@app/features/devtools/state/DeveloperOptions';
import DeveloperOptions from '@app/features/devtools/state/DeveloperOptions';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const ACTIVE_DEVELOPER_OPTION_KEYS = DEVELOPER_OPTION_KEYS;
const ATTACHMENT_MOCKS_DESCRIPTOR = msg({
	message: 'Attachment mocks',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const ATTACHMENTS_PLURAL_DESCRIPTOR = msg({
	message: '{count, plural, one {# attachment} other {# attachments}}',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const BYPASS_LOADING_SKELETON_DESCRIPTOR = msg({
	message: 'Bypass loading skeleton',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const FORCE_LOADING_SKELETON_DESCRIPTOR = msg({
	message: 'Force loading skeleton',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const FAIL_MESSAGE_SENDS_DESCRIPTOR = msg({
	message: 'Fail message sends',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const FAIL_MESSAGE_LOADS_DESCRIPTOR = msg({
	message: 'Fail message loads',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const SHOW_MYSELF_TYPING_DESCRIPTOR = msg({
	message: 'Show myself typing',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const SLOW_MESSAGE_LOAD_DESCRIPTOR = msg({
	message: 'Slow message load',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const SLOW_MESSAGE_SEND_DESCRIPTOR = msg({
	message: 'Slow message send',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const SLOW_PROFILE_LOAD_DESCRIPTOR = msg({
	message: 'Slow profile load',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const PROFILE_SKELETONS_DESCRIPTOR = msg({
	message: 'Profile skeletons',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const PROFILE_DATA_WARNING_DESCRIPTOR = msg({
	message: 'Profile data warning',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const UNKNOWN_MESSAGE_TYPE_DESCRIPTOR = msg({
	message: 'Unknown message type',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const SELF_HOSTED_MODE_DESCRIPTOR = msg({
	message: 'Self-hosted mode',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const VANITY_URL_DISCLAIMER_DESCRIPTOR = msg({
	message: 'Vanity URL disclaimer',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const UNCLAIMED_ACCOUNT_LABEL_DESCRIPTOR = msg({
	message: 'Unclaimed account',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const VERIFICATION_BARRIER_DESCRIPTOR = msg({
	message: 'Verification barrier',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const BARRIER_COUNTDOWN_DESCRIPTOR = msg({
	message: 'Barrier countdown',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const MATURE_CHANNEL_GATE_DESCRIPTOR = msg({
	message: 'Mature content channel gate',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const MATURE_MEDIA_GATE_DESCRIPTOR = msg({
	message: 'Mature content media gate',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const FORCE_MATURE_MEDIA_DESCRIPTOR = msg({
	message: 'Force mature media',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const UK_GEO_DESCRIPTOR = msg({
	message: 'UK geo',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const NO_SEND_PERMISSION_DESCRIPTOR = msg({
	message: 'No {sendMessagesPermission} permission',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const NO_ATTACH_PERMISSION_DESCRIPTOR = msg({
	message: 'No {attachFilesPermission} permission',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const SLOWMODE_ACTIVE_DESCRIPTOR = msg({
	message: 'Slowmode active',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const SLOWMODE_REMAINING_DESCRIPTOR = msg({
	message: 'Slowmode remaining',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const TITLEBAR_PLATFORM_DESCRIPTOR = msg({
	message: 'Title bar platform',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const DEVELOPER_OPTION_DESCRIPTOR = msg({
	message: 'Developer option',
	comment: 'Developer tools debug menu label. Internal-only surface for developers; translators may keep this terse.',
});
const DEVELOPER_OPTION_LABEL_FALLBACKS: Partial<Record<keyof DeveloperOptionsState, MessageDescriptor>> = {
	mockAttachmentStates: ATTACHMENT_MOCKS_DESCRIPTOR,
};
const getDeveloperOptionFallbackLabel = (i18n: I18n, key: keyof DeveloperOptionsState): string => {
	const descriptor = DEVELOPER_OPTION_LABEL_FALLBACKS[key];
	return descriptor ? i18n._(descriptor) : humanizeDeveloperStateKey(String(key));
};
const getDeveloperOptionFallbackValue = <K extends keyof DeveloperOptionsState>(
	i18n: I18n,
	key: K,
	value: DeveloperOptionsState[K],
): string => {
	if (key === 'mockAttachmentStates') {
		const count = Object.keys(value as DeveloperOptionsState['mockAttachmentStates']).length;
		return i18n._(ATTACHMENTS_PLURAL_DESCRIPTOR, {count});
	}
	if (value instanceof Date) return value.toLocaleDateString();
	if (typeof value === 'boolean') return value ? i18n._(ENABLED_DESCRIPTOR) : i18n._(FORCED_OFF_DESCRIPTOR);
	if (typeof value === 'number') return String(value);
	if (typeof value === 'string') return nonEmptyText(value.replace(/_/g, ' '), i18n._(CUSTOM_VALUE_DESCRIPTOR));
	if (value === null) return i18n._(USE_ACTUAL_VALUE_DESCRIPTOR);
	return i18n._(ACTIVE_DESCRIPTOR);
};
const formatDeveloperOptionValue = <K extends keyof DeveloperOptionsState>(
	i18n: I18n,
	key: K,
	value: DeveloperOptionsState[K],
): string => {
	switch (key) {
		case 'mockBarrierTimeRemaining':
		case 'mockSlowmodeRemaining':
			return typeof value === 'number' ? formatDurationMs(i18n, value) : i18n._(USE_DEFAULT_DESCRIPTOR);
		case 'mockVerificationBarrier':
		case 'mockMatureContentGateReason':
		case 'mockMatureMediaGateReason':
		case 'mockTitlebarPlatformOverride':
			return String(value).replace(/_/g, ' ');
		case 'mockAttachmentStates': {
			const count = Object.keys(value as DeveloperOptionsState['mockAttachmentStates']).length;
			return i18n._(ATTACHMENTS_PLURAL_DESCRIPTOR, {count});
		}
		default:
			if (typeof value === 'boolean') return value ? i18n._(ENABLED_DESCRIPTOR) : i18n._(FORCED_OFF_DESCRIPTOR);
			if (value === null) return i18n._(USE_ACTUAL_VALUE_DESCRIPTOR);
			return String(value);
	}
};
const getDeveloperOptionLabel = (key: keyof DeveloperOptionsState): MessageDescriptor => {
	switch (key) {
		case 'bypassLoadingSkeleton':
			return BYPASS_LOADING_SKELETON_DESCRIPTOR;
		case 'forceLoadingSkeleton':
			return FORCE_LOADING_SKELETON_DESCRIPTOR;
		case 'forceFailMessageSends':
			return FAIL_MESSAGE_SENDS_DESCRIPTOR;
		case 'forceFailMessageLoads':
			return FAIL_MESSAGE_LOADS_DESCRIPTOR;
		case 'showMyselfTyping':
			return SHOW_MYSELF_TYPING_DESCRIPTOR;
		case 'slowMessageLoad':
			return SLOW_MESSAGE_LOAD_DESCRIPTOR;
		case 'slowMessageSend':
			return SLOW_MESSAGE_SEND_DESCRIPTOR;
		case 'slowProfileLoad':
			return SLOW_PROFILE_LOAD_DESCRIPTOR;
		case 'forceProfileSkeletons':
			return PROFILE_SKELETONS_DESCRIPTOR;
		case 'forceProfileDataWarning':
			return PROFILE_DATA_WARNING_DESCRIPTOR;
		case 'forceUnknownMessageType':
			return UNKNOWN_MESSAGE_TYPE_DESCRIPTOR;
		case 'selfHostedModeOverride':
			return SELF_HOSTED_MODE_DESCRIPTOR;
		case 'forceShowVanityURLDisclaimer':
			return VANITY_URL_DISCLAIMER_DESCRIPTOR;
		case 'unclaimedAccountOverride':
			return UNCLAIMED_ACCOUNT_LABEL_DESCRIPTOR;
		case 'mockVerificationBarrier':
			return VERIFICATION_BARRIER_DESCRIPTOR;
		case 'mockBarrierTimeRemaining':
			return BARRIER_COUNTDOWN_DESCRIPTOR;
		case 'mockMatureContentGateReason':
			return MATURE_CHANNEL_GATE_DESCRIPTOR;
		case 'mockMatureMediaGateReason':
			return MATURE_MEDIA_GATE_DESCRIPTOR;
		case 'forceMatureMedia':
			return FORCE_MATURE_MEDIA_DESCRIPTOR;
		case 'mockInUK':
			return UK_GEO_DESCRIPTOR;
		case 'forceNoSendMessages':
			return {...NO_SEND_PERMISSION_DESCRIPTOR, values: {sendMessagesPermission: SEND_MESSAGES_PERMISSION}};
		case 'forceNoAttachFiles':
			return {...NO_ATTACH_PERMISSION_DESCRIPTOR, values: {attachFilesPermission: ATTACH_FILES_PERMISSION}};
		case 'mockSlowmodeActive':
			return SLOWMODE_ACTIVE_DESCRIPTOR;
		case 'mockSlowmodeRemaining':
			return SLOWMODE_REMAINING_DESCRIPTOR;
		case 'mockTitlebarPlatformOverride':
			return TITLEBAR_PLATFORM_DESCRIPTOR;
		case 'mockAttachmentStates':
			return ATTACHMENT_MOCKS_DESCRIPTOR;
		default:
			return DEVELOPER_OPTION_DESCRIPTOR;
	}
};
export const getActiveDeveloperOptionEntries = (i18n: I18n): Array<ActiveOverrideEntry> => {
	return ACTIVE_DEVELOPER_OPTION_KEYS.filter((key) => !isDeveloperOptionAtDefault(key)).map((key) => {
		const currentValue = DeveloperOptions[key];
		return {
			key,
			label: nonEmptyText(
				translateDescriptor(i18n, getDeveloperOptionLabel(key)),
				getDeveloperOptionFallbackLabel(i18n, key),
			),
			value: nonEmptyText(
				formatDeveloperOptionValue(i18n, key, currentValue),
				getDeveloperOptionFallbackValue(i18n, key, currentValue),
			),
			reset: () => resetDeveloperOption(key),
		};
	});
};
