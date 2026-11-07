// SPDX-License-Identifier: AGPL-3.0-or-later

import {openClaimAccountModal} from '@app/features/auth/components/modals/ClaimAccountModal';
import {Button} from '@app/features/ui/button/Button';
import {WarningAlert} from '@app/features/ui/warning_alert/WarningAlert';
import {
	getUnclaimedAccountPresentation,
	UnclaimedAccountSurfaces,
} from '@app/features/user/utils/AccountGatePresentation';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const UnclaimedAccountAlert = observer(() => {
	const {i18n} = useLingui();
	const presentation = getUnclaimedAccountPresentation(i18n, UnclaimedAccountSurfaces.ALERT);
	return (
		<WarningAlert
			title={<Trans>Unclaimed account</Trans>}
			actions={
				<Button
					small={true}
					onClick={() => openClaimAccountModal()}
					data-flx="app.unclaimed-account-alert.button.open-claim-account-modal"
				>
					{presentation.actionLabel}
				</Button>
			}
			data-flx="app.unclaimed-account-alert.warning-alert"
		>
			{presentation.message}
		</WarningAlert>
	);
});
