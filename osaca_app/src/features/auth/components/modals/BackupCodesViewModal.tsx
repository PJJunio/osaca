// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import * as MfaCommands from '@app/features/auth/commands/MfaCommands';
import {BackupCodesModal} from '@app/features/auth/components/modals/BackupCodesModal';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import type {User} from '@app/features/user/models/User';
import * as FormUtils from '@app/lib/forms';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useState} from 'react';

const VIEW_BACKUP_CODES_DESCRIPTOR = msg({
	message: 'View backup codes',
	comment: 'Short label in the authentication backup codes view modal. Keep the tone plain and specific.',
});
const UNABLE_TO_LOAD_BACKUP_CODES_DESCRIPTOR = msg({
	message: 'Unable to load backup codes',
	comment: 'Error title shown when backup codes could not be loaded after confirming identity.',
});

interface BackupCodesViewModalProps {
	user: User;
}

export const BackupCodesViewModal = observer(({user}: BackupCodesViewModalProps) => {
	const {i18n} = useLingui();
	const [submitting, setSubmitting] = useState<boolean>(false);
	const showWithSudo = useCallback(async () => {
		setSubmitting(true);
		try {
			const backupCodes = await MfaCommands.getBackupCodes(false);
			ModalCommands.popByType(BackupCodesViewModal);
			ModalCommands.pushWithKey(
				modal(() => (
					<BackupCodesModal
						backupCodes={backupCodes}
						user={user}
						data-flx="auth.backup-codes-view-modal.show-with-sudo.backup-codes-modal"
					/>
				)),
				'backup-codes',
			);
		} catch (error: unknown) {
			FormUtils.pushApiErrorModal(i18n, error, i18n._(UNABLE_TO_LOAD_BACKUP_CODES_DESCRIPTOR));
		} finally {
			setSubmitting(false);
		}
	}, [user, i18n]);
	return (
		<Modal.Root size="small" centered data-flx="auth.backup-codes-view-modal.modal-root">
			<Modal.Header title={i18n._(VIEW_BACKUP_CODES_DESCRIPTOR)} data-flx="auth.backup-codes-view-modal.modal-header" />
			<Modal.Content data-flx="auth.backup-codes-view-modal.modal-content">
				<Modal.ContentLayout data-flx="auth.backup-codes-view-modal.modal-content-layout">
					<Modal.Description data-flx="auth.backup-codes-view-modal.modal-description">
						<Trans>Confirm it's you before you view your backup codes.</Trans>
					</Modal.Description>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer data-flx="auth.backup-codes-view-modal.modal-footer">
				<Button onClick={ModalCommands.pop} variant="secondary" data-flx="auth.backup-codes-view-modal.button.pop">
					<Trans>Cancel</Trans>
				</Button>
				<Button
					onClick={showWithSudo}
					submitting={submitting}
					data-flx="auth.backup-codes-view-modal.button.start-challenge"
				>
					<Trans>Continue</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
