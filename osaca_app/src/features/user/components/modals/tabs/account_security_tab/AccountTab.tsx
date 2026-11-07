// SPDX-License-Identifier: AGPL-3.0-or-later

import {UnclaimedAccountAlert} from '@app/features/app/components/dialogs/components/UnclaimedAccountAlert';
import {openClaimAccountModal} from '@app/features/auth/components/modals/ClaimAccountModal';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import {PasswordChangeModal} from '@app/features/user/components/modals/PasswordChangeModal';
import {
	AccountSecurityCard,
	AccountSecurityRow,
} from '@app/features/user/components/modals/tabs/account_security_tab/AccountSecurityCard';
import {
	RecoveryKitReminderAlert,
	RecoveryKitRow,
} from '@app/features/user/components/modals/tabs/account_security_tab/RecoveryKitSettings';
import type {User} from '@app/features/user/models/User';
import * as DateUtils from '@app/features/user/utils/DateFormatting';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {AccountTiers, AccountVerificationNeeds} from '@osaca/constants/src/AccountTierConstants';
import {observer} from 'mobx-react-lite';
import type React from 'react';

const SIGN_IN_METHODS_DESCRIPTOR = msg({
	message: 'Sign-in methods',
	comment: 'Accessible name for the group of password and recovery kit rows in account settings.',
});
interface AccountTabProps {
	user: User;
}

export const AccountTabContent: React.FC<AccountTabProps> = observer(({user}) => {
	const {i18n} = useLingui();
	const needsPassword = user.verificationNeed === AccountVerificationNeeds.SET_PASSWORD;
	const isClaimed = user.accountTier !== AccountTiers.UNCLAIMED;
	let passwordRow: React.ReactNode;
	if (needsPassword) {
		passwordRow = (
			<AccountSecurityRow
				label={<Trans>Password</Trans>}
				warning={<Trans>No password set</Trans>}
				data-flx="user.account-security-tab.account-tab.account-tab-content.password-row--unclaimed"
			>
				<Button
					small={true}
					onClick={() => openClaimAccountModal()}
					data-flx="user.account-security-tab.account-tab.account-tab-content.button.set-password"
				>
					<Trans>Set password</Trans>
				</Button>
			</AccountSecurityRow>
		);
	} else {
		passwordRow = (
			<AccountSecurityRow
				label={<Trans>Password</Trans>}
				description={
					user.passwordLastChangedAt ? (
						<Trans>Last changed: {DateUtils.getRelativeDateString(user.passwordLastChangedAt, i18n)}</Trans>
					) : (
						<Trans>Last changed: never</Trans>
					)
				}
				data-flx="user.account-security-tab.account-tab.account-tab-content.password-row"
			>
				<Button
					variant="secondary"
					small={true}
					onClick={() =>
						ModalCommands.push(
							modal(() => (
								<PasswordChangeModal data-flx="user.account-security-tab.account-tab.account-tab-content.password-change-modal" />
							)),
						)
					}
					data-flx="user.account-security-tab.account-tab.account-tab-content.button.change-password"
				>
					<Trans>Change password</Trans>
				</Button>
			</AccountSecurityRow>
		);
	}
	return (
		<>
			{needsPassword && (
				<UnclaimedAccountAlert data-flx="user.account-security-tab.account-tab.account-tab-content.unclaimed-account-alert" />
			)}
			{isClaimed && (
				<RecoveryKitReminderAlert
					user={user}
					data-flx="user.account-security-tab.account-tab.account-tab-content.recovery-kit-reminder-alert"
				/>
			)}
			<AccountSecurityCard
				aria-label={i18n._(SIGN_IN_METHODS_DESCRIPTOR)}
				data-flx="user.account-security-tab.account-tab.account-tab-content.rows"
			>
				{passwordRow}
				{isClaimed && (
					<RecoveryKitRow
						user={user}
						data-flx="user.account-security-tab.account-tab.account-tab-content.recovery-kit-row"
					/>
				)}
			</AccountSecurityCard>
		</>
	);
});
