// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {mlsClientManager} from '@app/features/crypto/MlsClientManager';
import {tofuKeyManager} from '@app/features/crypto/TofuKeyManager';
import {Button} from '@app/features/ui/button/Button';
import {Checkbox} from '@app/features/ui/checkbox/Checkbox';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import * as TextCopyCommands from '@app/features/ui/commands/TextCopyCommands';
import {QRCodeCanvas} from '@app/features/ui/components/QRCodeCanvas';
import {Trans, useLingui} from '@lingui/react/macro';
import type {SafetyNumber} from '@osaca/crypto';
import {CheckIcon, ClipboardIcon, WarningIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useState} from 'react';
import styles from './VerifySafetyNumberModal.module.css';

export const VERIFY_SAFETY_NUMBER_MODAL_KEY = 'verify-safety-number-modal';

export interface VerifySafetyNumberModalProps {
	contactUserId: string;
	contactUsername?: string;
	onClose?: () => void;
}

export const VerifySafetyNumberModal = observer(
	({contactUserId, contactUsername = 'contact', onClose}: VerifySafetyNumberModalProps) => {
		const {i18n} = useLingui();
		const [safetyNumber, setSafetyNumber] = useState<SafetyNumber | null>(null);
		const [loading, setLoading] = useState(true);
		const [copied, setCopied] = useState(false);

		const contactRecord = tofuKeyManager.getContactIdentity(contactUserId);
		const isVerified = tofuKeyManager.isVerified(contactUserId);
		const hasKeyChanged = tofuKeyManager.hasKeyChanged(contactUserId);

		const loadSafetyNumber = useCallback(async () => {
			setLoading(true);
			const localIdentity = mlsClientManager.getIdentityKey();
			if (!localIdentity) {
				setLoading(false);
				return;
			}
			try {
				const sn = await tofuKeyManager.deriveSafetyNumber(contactUserId, localIdentity);
				setSafetyNumber(sn);
			} finally {
				setLoading(false);
			}
		}, [contactUserId]);

		useEffect(() => {
			void loadSafetyNumber();
		}, [loadSafetyNumber]);

		const handleToggleVerified = useCallback(
			(checked: boolean) => {
				tofuKeyManager.setContactVerified(contactUserId, checked);
			},
			[contactUserId],
		);

		const handleAcknowledgeKeyChange = useCallback(async () => {
			tofuKeyManager.acknowledgeKeyChange(contactUserId);
			await loadSafetyNumber();
		}, [contactUserId, loadSafetyNumber]);

		const handleCopy = useCallback(async () => {
			if (!safetyNumber) return;
			await TextCopyCommands.copy(i18n, safetyNumber.formattedText);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}, [i18n, safetyNumber]);

		const handleClose = useCallback(() => {
			ModalCommands.popWithKey(VERIFY_SAFETY_NUMBER_MODAL_KEY);
			onClose?.();
		}, [onClose]);

		return (
			<Modal.Root size="small" onClose={handleClose} data-flx="crypto.verify-safety-number-modal.root">
				<Modal.Header
					title={<Trans>Verify Safety Number</Trans>}
					data-flx="crypto.verify-safety-number-modal.header"
				/>
				<Modal.Content data-flx="crypto.verify-safety-number-modal.content">
					<Modal.ContentLayout data-flx="crypto.verify-safety-number-modal.layout">
						<div className={styles.container} data-flx="crypto.verify-safety-number-modal.container">
							<p className={styles.description} data-flx="crypto.verify-safety-number-modal.description">
								<Trans>
									Safety Numbers allow you to verify the end-to-end encryption with {contactUsername}. Compare this
									60-digit number or scan the QR code on their device to prevent impersonation.
								</Trans>
							</p>

							{hasKeyChanged && (
								<div className={styles.warningCard} data-flx="crypto.verify-safety-number-modal.warning-card">
									<div className={styles.warningTitle} data-flx="crypto.verify-safety-number-modal.warning-title">
										<WarningIcon size={18} weight="bold" />
										<Trans>Identity Key Changed</Trans>
									</div>
									<p className={styles.warningBody} data-flx="crypto.verify-safety-number-modal.warning-body">
										<Trans>
											{contactUsername}'s identity key has changed since you last connected. This could happen if they
											reinstalled OSACA or added a new device.
										</Trans>
									</p>
									<Button
										variant="danger"
										small={true}
										onClick={handleAcknowledgeKeyChange}
										data-flx="crypto.verify-safety-number-modal.button.acknowledge-key"
									>
										<Trans>Acknowledge & Trust New Key</Trans>
									</Button>
								</div>
							)}

							{safetyNumber && (
								<>
									<div className={styles.qrWrapper} data-flx="crypto.verify-safety-number-modal.qr-wrapper">
										<QRCodeCanvas data={safetyNumber.qrPayload} size={160} />
									</div>

									<div
										className={styles.safetyNumberBox}
										data-flx="crypto.verify-safety-number-modal.safety-number-box"
									>
										<div className={styles.numberText} data-flx="crypto.verify-safety-number-modal.number-text">
											{safetyNumber.formattedText}
										</div>
										<Button
											variant="secondary"
											small={true}
											leftIcon={
												copied ? <CheckIcon size={16} weight="bold" /> : <ClipboardIcon size={16} weight="bold" />
											}
											onClick={handleCopy}
											data-flx="crypto.verify-safety-number-modal.button.copy"
										>
											{copied ? <Trans>Copied</Trans> : <Trans>Copy Number</Trans>}
										</Button>
									</div>
								</>
							)}

							{!safetyNumber && !loading && (
								<p className={styles.description}>
									<Trans>No identity key available yet for this contact.</Trans>
								</p>
							)}

							{contactRecord && (
								<div
									className={styles.verificationSection}
									data-flx="crypto.verify-safety-number-modal.verification-section"
								>
									<Checkbox
										checked={isVerified}
										onChange={handleToggleVerified}
										data-flx="crypto.verify-safety-number-modal.checkbox.mark-verified"
									>
										<div>
											<div className={styles.verifiedLabel}>
												<Trans>Mark as Verified</Trans>
											</div>
											<div className={styles.verifiedSubtext}>
												<Trans>Mark this contact as verified after comparing safety numbers.</Trans>
											</div>
										</div>
									</Checkbox>
								</div>
							)}
						</div>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer data-flx="crypto.verify-safety-number-modal.footer">
					<Button variant="primary" onClick={handleClose} data-flx="crypto.verify-safety-number-modal.button.done">
						<Trans>Done</Trans>
					</Button>
				</Modal.Footer>
			</Modal.Root>
		);
	},
);

export function openVerifySafetyNumberModal(props: VerifySafetyNumberModalProps): void {
	ModalCommands.popWithKey(VERIFY_SAFETY_NUMBER_MODAL_KEY);
	ModalCommands.pushWithKey(
		modal(() => <VerifySafetyNumberModal {...props} />),
		VERIFY_SAFETY_NUMBER_MODAL_KEY,
	);
}
