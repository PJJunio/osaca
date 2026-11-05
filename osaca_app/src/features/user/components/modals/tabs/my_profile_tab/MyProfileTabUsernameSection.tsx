// SPDX-License-Identifier: AGPL-3.0-or-later

import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import {OsacaTagChangeModal} from '@app/features/user/components/modals/OsacaTagChangeModal';
import styles from '@app/features/user/components/modals/tabs/my_profile_tab/MyProfileTabUsernameSection.module.css';
import type {User} from '@app/features/user/models/User';
import {accountGateReason} from '@app/features/user/utils/AccountGatePresentation';
import type {AccountGateResult} from '@app/features/user/utils/AccountGates';
import type {I18n} from '@lingui/core';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

function usernameChangeBlockedReason(i18n: I18n, profileGate: AccountGateResult): string | null {
	if (!profileGate.allowed) return accountGateReason(i18n, profileGate);
	return null;
}

interface UsernameSectionProps {
	profileGate: AccountGateResult;
	user: User;
}

export const UsernameSection = observer(({profileGate, user}: UsernameSectionProps) => {
	const {i18n} = useLingui();
	const disabledReason = usernameChangeBlockedReason(i18n, profileGate);
	return (
		<div data-flx="user.my-profile-tab.username-section.div">
			<div className={styles.label} data-flx="user.my-profile-tab.username-section.label">
				<Trans>Username</Trans>
			</div>
			<div className={styles.actions} data-flx="user.my-profile-tab.username-section.actions">
				{disabledReason !== null ? (
					<Tooltip text={disabledReason} data-flx="user.my-profile-tab.username-section.tooltip">
						<div data-flx="user.my-profile-tab.username-section.div--2">
							<Button variant="primary" small disabled data-flx="user.my-profile-tab.username-section.button">
								<Trans>Change username</Trans>
							</Button>
						</div>
					</Tooltip>
				) : (
					<Button
						variant="primary"
						small
						onClick={() =>
							ModalCommands.push(
								modal(() => (
									<OsacaTagChangeModal
										user={user}
										data-flx="user.my-profile-tab.username-section.osaca-tag-change-modal"
									/>
								)),
							)
						}
						data-flx="user.my-profile-tab.username-section.button.push"
					>
						<Trans>Change username</Trans>
					</Button>
				)}
			</div>
		</div>
	);
});
