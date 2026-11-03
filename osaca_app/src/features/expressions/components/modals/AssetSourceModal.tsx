// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import styles from '@app/features/expressions/components/modals/AssetSourceModal.module.css';
import {remFromPx} from '@app/features/theme/layout/RemFromPx';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import FocusRing from '@app/features/ui/focus_ring/FocusRing';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {UploadSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const UPLOAD_A_FILE_DESCRIPTOR = msg({
	message: 'Upload a file',
	comment: 'Card label in the asset source modal for uploading an image from the device. Keep it concise.',
});

export interface AssetSourceModalProps {
	title: string;
	uploadHint: React.ReactNode;
	onPickUpload: () => void | Promise<void>;
}

const AssetSourceModal = observer(function AssetSourceModal({title, uploadHint, onPickUpload}: AssetSourceModalProps) {
	const {i18n} = useLingui();
	const handleClose = useCallback(() => {
		ModalCommands.pop();
	}, []);
	const handlePickUpload = useCallback(() => {
		const sourceModalKey = ModalCommands.getTopModalKey();
		const closeSourceModal = () => {
			if (sourceModalKey) ModalCommands.popWithKey(sourceModalKey);
		};
		try {
			void Promise.resolve(onPickUpload()).finally(closeSourceModal);
		} catch (error) {
			closeSourceModal();
			throw error;
		}
	}, [onPickUpload]);
	return (
		<Modal.Root size="small" data-flx="expressions.asset-source-modal.modal-root">
			<Modal.Header title={title} onClose={handleClose} data-flx="expressions.asset-source-modal.modal-header" />
			<Modal.Content data-flx="expressions.asset-source-modal.modal-content">
				<div className={`${styles.cards} ${styles.cardsSingle}`} data-flx="expressions.asset-source-modal.cards">
					<FocusRing offset={-2} data-flx="expressions.asset-source-modal.focus-ring">
						<button
							type="button"
							className={styles.card}
							onClick={handlePickUpload}
							data-flx="expressions.asset-source-modal.card.pick-upload"
						>
							<div className={styles.cardIcon} data-flx="expressions.asset-source-modal.card-icon">
								<UploadSimpleIcon
									size={remFromPx(24)}
									weight="bold"
									data-flx="expressions.asset-source-modal.upload-icon"
								/>
							</div>
							<div className={styles.cardLabel} data-flx="expressions.asset-source-modal.card-label">
								{i18n._(UPLOAD_A_FILE_DESCRIPTOR)}
							</div>
							<div className={styles.cardHint} data-flx="expressions.asset-source-modal.card-hint">
								{uploadHint}
							</div>
						</button>
					</FocusRing>
				</div>
			</Modal.Content>
		</Modal.Root>
	);
});

export function openAssetSourceModal(props: AssetSourceModalProps): void {
	ModalCommands.push(
		modal(() => <AssetSourceModal {...props} data-flx="expressions.asset-source-modal.asset-source-modal" />),
	);
}
