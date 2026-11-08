// SPDX-License-Identifier: AGPL-3.0-or-later

import {openVerifySafetyNumberModal} from '@app/features/crypto/components/VerifySafetyNumberModal';
import {tofuKeyManager} from '@app/features/crypto/TofuKeyManager';
import {Button} from '@app/features/ui/button/Button';
import Users from '@app/features/user/state/Users';
import * as NicknameUtils from '@app/features/user/utils/NicknameUtils';
import {Trans} from '@lingui/react/macro';
import {ShieldWarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import styles from './SafetyNumberWarningBanner.module.css';

export interface SafetyNumberWarningBannerProps {
	changedRecipientIds: ReadonlyArray<string>;
	channelId?: string;
}

export const SafetyNumberWarningBanner = observer(({changedRecipientIds}: SafetyNumberWarningBannerProps) => {
	const activeChanged = changedRecipientIds.filter((id) => tofuKeyManager.hasKeyChanged(id));
	if (activeChanged.length === 0) {
		return null;
	}

	return (
		<div className={styles.banner} data-flx="channel.alerts.safety-number-warning-banner">
			<ShieldWarningIcon size={24} weight="fill" className={styles.icon} />
			<div className={styles.content}>
				<div className={styles.title}>
					<Trans>Security Warning: Identity Key Changed</Trans>
				</div>
				{activeChanged.map((userId) => {
					const user = Users.getUser(userId);
					const username = user ? NicknameUtils.getNickname(user, null) : userId;

					const handleVerify = () => {
						openVerifySafetyNumberModal({
							contactUserId: userId,
							contactUsername: username,
						});
					};

					const handleAcknowledge = () => {
						tofuKeyManager.acknowledgeKeyChange(userId);
					};

					return (
						<div key={userId}>
							<p className={styles.message}>
								<Trans>
									{username}'s identity key has changed since you first connected. You should verify their Safety Number
									before trusting this conversation.
								</Trans>
							</p>
							<div className={styles.actions}>
								<Button
									variant="secondary"
									small={true}
									onClick={handleVerify}
									data-flx="channel.alerts.safety-number-warning-banner.button.verify"
								>
									<Trans>Verify Safety Number</Trans>
								</Button>
								<Button
									variant="danger"
									small={true}
									onClick={handleAcknowledge}
									data-flx="channel.alerts.safety-number-warning-banner.button.acknowledge"
								>
									<Trans>Acknowledge & Trust New Key</Trans>
								</Button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
});
