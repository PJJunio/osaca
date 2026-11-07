// SPDX-License-Identifier: AGPL-3.0-or-later

import {StatusSlate} from '@app/features/app/components/dialogs/shared/StatusSlate';
import {CLAIM_ACCOUNT_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import type {I18n, MessageDescriptor} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {type AccountVerificationNeed, TierGatedActions} from '@osaca/constants/src/AccountTierConstants';
import type {ValueOf} from '@osaca/constants/src/ValueOf';
import {type Icon, UserCircleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const AccountGateActions = {
	...TierGatedActions,
	PURCHASE: 'purchase',
} as const;

export type AccountGateAction = ValueOf<typeof AccountGateActions>;

export interface AccountGate {
	readonly action: AccountGateAction;
	readonly need: AccountVerificationNeed;
}

export interface AccountGatePresentation {
	readonly Icon: Icon;
	readonly title: string;
	readonly description: string;
	readonly actionLabel: string;
	readonly onAction: () => void;
}

const SET_PASSWORD_REASONS: Readonly<Record<AccountGateAction, MessageDescriptor>> = {
	[AccountGateActions.MESSAGE]: msg({
		message: 'Set a password to send messages.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to send a message.',
	}),
	[AccountGateActions.TYPING]: msg({
		message: 'Set a password to send messages.',
		comment: 'Reason shown when someone whose account has no password or passkey yet starts typing a message.',
	}),
	[AccountGateActions.REACTION]: msg({
		message: 'Set a password to add reactions.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to react to a message.',
	}),
	[AccountGateActions.DIRECT_MESSAGE]: msg({
		message: 'Set a password to send direct messages.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to send a direct message.',
	}),
	[AccountGateActions.DIRECT_MESSAGE_OPEN]: msg({
		message: 'Set a password to message people directly.',
		comment:
			'Reason shown when someone whose account has no password or passkey yet tries to start a direct message or group chat.',
	}),
	[AccountGateActions.GROUP_DM]: msg({
		message: 'Set a password to join group chats.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to join a group chat.',
	}),
	[AccountGateActions.FRIEND_REQUEST]: msg({
		message: 'Set a password to add friends.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to send a friend request.',
	}),
	[AccountGateActions.FRIEND_ACCEPT]: msg({
		message: 'Set a password to accept friend requests.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to accept a friend request.',
	}),
	[AccountGateActions.INVITE_CREATE]: msg({
		message: 'Set a password to invite people.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to create an invite.',
	}),
	[AccountGateActions.GUILD_JOIN]: msg({
		message: 'Set a password to join this community.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to join a community.',
	}),
	[AccountGateActions.GUILD_CREATE]: msg({
		message: 'Set a password to create a community.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to create a community.',
	}),
	[AccountGateActions.VOICE]: msg({
		message: 'Set a password to join voice channels.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to join a voice channel.',
	}),
	[AccountGateActions.CALL]: msg({
		message: 'Set a password to start or join calls.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to start or join a call.',
	}),
	[AccountGateActions.GROUP_CALL]: msg({
		message: 'Set a password to start or join group calls.',
		comment:
			'Reason shown when someone whose account has no password or passkey yet tries to start or join a call in a group chat.',
	}),
	[AccountGateActions.THREAD_JOIN]: msg({
		message: 'Set a password to join threads.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to join a thread.',
	}),
	[AccountGateActions.CHANNEL_FOLLOW]: msg({
		message: 'Set a password to follow channels.',
		comment:
			'Reason shown when someone whose account has no password or passkey yet tries to follow an announcement channel.',
	}),
	[AccountGateActions.OWNERSHIP_TRANSFER]: msg({
		message: 'This person needs to set a password before they can own a community.',
		comment:
			'Reason shown when the new owner picked for a community has not finished setting up their account. Variant: they have no password or passkey.',
	}),
	[AccountGateActions.APPLICATION_CREATE]: msg({
		message: 'Set a password to create applications.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to create an application.',
	}),
	[AccountGateActions.GIFT_REDEEM]: msg({
		message: 'Set a password to redeem gifts.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to redeem a gift.',
	}),
	[AccountGateActions.PROFILE_CUSTOMIZE]: msg({
		message: 'Set a password to edit your profile.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to change their profile.',
	}),
	[AccountGateActions.REPORT]: msg({
		message: 'Set a password to submit reports.',
		comment: 'Reason shown when someone whose account has no password or passkey yet tries to submit a report.',
	}),
	[AccountGateActions.MFA]: msg({
		message: 'Set a password to set up two-factor authentication and passkeys.',
		comment:
			'Reason shown when someone whose account has no password or passkey yet tries to turn on two-factor authentication or add a passkey.',
	}),
	[AccountGateActions.GUILD_VERIFICATION]: msg({
		message: 'Set a password to talk in this community.',
		comment:
			'Reason shown when someone whose account has no password or passkey yet tries to talk in a community that needs a finished account.',
	}),
	[AccountGateActions.PURCHASE]: msg({
		message: 'Set a password to make purchases.',
		comment: 'Reason shown when someone whose account has no password or passkey yet starts a purchase.',
	}),
};
const SET_PASSWORD_TITLE = msg({
	message: 'Set a password',
	comment: 'Heading shown when an account needs a password before it can do something.',
});

const SET_PASSWORD_ACTION_LABEL = msg({
	message: 'Set password',
	comment: 'Button that opens the dialog for setting a password on the account.',
});

export const UnclaimedAccountSurfaces = {
	NAGBAR: 'nagbar',
	ALERT: 'alert',
	SIGN_OUT: 'sign_out',
} as const;

export type UnclaimedAccountSurface = ValueOf<typeof UnclaimedAccountSurfaces>;

export interface UnclaimedAccountPresentation {
	readonly message: string;
	readonly actionLabel: string;
}

const UNCLAIMED_SET_PASSWORD_MESSAGES: Readonly<Record<UnclaimedAccountSurface, MessageDescriptor>> = {
	[UnclaimedAccountSurfaces.NAGBAR]: msg({
		message: 'This account is unclaimed. Set a password to sign in on other devices.',
		comment: 'Quiet, dismissible bar for accounts that need a password before they can sign in on other devices.',
	}),
	[UnclaimedAccountSurfaces.ALERT]: msg({
		message: 'This account has no password yet. Set a password to sign in on other devices.',
		comment: 'Settings alert for an account that needs a password to sign in on other devices.',
	}),
	[UnclaimedAccountSurfaces.SIGN_OUT]: msg({
		message: "This account is unclaimed, so you can't sign back in to it. Set a password first to sign in again later.",
		comment: 'Sign out dialog text for an account that needs a password before it can sign back in.',
	}),
};

const UNCLAIMED_USERNAME_MESSAGES: Readonly<Record<UnclaimedAccountSurface, MessageDescriptor>> = {
	...UNCLAIMED_SET_PASSWORD_MESSAGES,
	[UnclaimedAccountSurfaces.ALERT]: msg({
		message:
			"Your account is not yet claimed. Without a username and password, you won't be able to sign in from other devices and you could lose access to your account. Claim your account now to secure it.",
		comment: 'Settings alert for an unclaimed account on an instance where people sign in with a username.',
	}),
};

export function getUnclaimedAccountPresentation(
	i18n: I18n,
	surface: UnclaimedAccountSurface,
): UnclaimedAccountPresentation {
	return {
		message: i18n._(UNCLAIMED_USERNAME_MESSAGES[surface]),
		actionLabel: i18n._(CLAIM_ACCOUNT_DESCRIPTOR),
	};
}

export function accountGateReason(i18n: I18n, gate: AccountGate): string {
	return i18n._(SET_PASSWORD_REASONS[gate.action]);
}

export function openAccountGateFlow(
	i18n: I18n,
	gate: AccountGate,
	onComplete?: () => void,
	onDismiss?: () => void,
): void {
	const reason = accountGateReason(i18n, gate);
	void import('@app/features/auth/components/modals/ClaimAccountModal').then(({openClaimAccountModal}) =>
		openClaimAccountModal({reason, onComplete, onDismiss}),
	);
}

export function getAccountGatePresentation(
	i18n: I18n,
	gate: AccountGate,
	onComplete?: () => void,
): AccountGatePresentation {
	return {
		Icon: UserCircleIcon,
		title: i18n._(SET_PASSWORD_TITLE),
		description: accountGateReason(i18n, gate),
		actionLabel: i18n._(SET_PASSWORD_ACTION_LABEL),
		onAction: () => openAccountGateFlow(i18n, gate, onComplete),
	};
}

interface AccountGateActionButton {
	readonly text: string;
	readonly onClick: () => void;
	readonly submitting: boolean;
}

export function useAccountGateAction(gate: AccountGate, onComplete?: () => void): AccountGateActionButton {
	const {i18n} = useLingui();
	const presentation = getAccountGatePresentation(i18n, gate, onComplete);
	return {text: presentation.actionLabel, onClick: presentation.onAction, submitting: false};
}

interface AccountGateSlateProps {
	readonly gate: AccountGate;
	readonly onComplete?: () => void;
	readonly fullHeight?: boolean;
}

export const AccountGateSlate: React.FC<AccountGateSlateProps> = observer(({gate, onComplete, fullHeight}) => {
	const {i18n} = useLingui();
	const presentation = getAccountGatePresentation(i18n, gate, onComplete);
	const action = useAccountGateAction(gate, onComplete);
	return (
		<StatusSlate
			Icon={presentation.Icon}
			title={presentation.title}
			description={presentation.description}
			actions={[{text: action.text, onClick: action.onClick, submitting: action.submitting}]}
			fullHeight={fullHeight}
			data-flx="user.account-gate-slate.status-slate"
		/>
	);
});
