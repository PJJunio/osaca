// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import AppStorage from '@app/features/platform/state/PersistentStorage';
import {Button} from '@app/features/ui/button/Button';
import styles from '@app/features/user/components/modals/tabs/privacy_safety_tab/DataDeletionTab.module.css';
import {exportClientUserData} from '@app/features/user/utils/ClientDataExport';
import * as DateUtils from '@app/features/user/utils/DateFormatting';
import * as FormUtils from '@app/lib/forms';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

const LAST_EXPORT_KEY = 'osaca:export:last-exported-at';

export const EXPORT_TAB_DESCRIPTION = msg({
	message:
		'Build a downloadable archive of your account data and locally decrypted conversation messages. All data is processed and packaged entirely on your device.',
	comment: 'Description shown on the settings page above the Export my data button.',
});

export const DataExportTabContent: React.FC = observer(() => {
	const {i18n} = useLingui();
	const [exporting, setExporting] = useState(false);
	const [lastExportedAt, setLastExportedAt] = useState<string | null>(() => AppStorage.getItem(LAST_EXPORT_KEY));

	const handleExport = useCallback(async () => {
		if (exporting) return;
		setExporting(true);
		try {
			await exportClientUserData(i18n);
			const now = new Date().toISOString();
			setLastExportedAt(now);
			AppStorage.setItem(LAST_EXPORT_KEY, now);
		} catch (error) {
			FormUtils.pushApiErrorModal(i18n, error);
		} finally {
			setExporting(false);
		}
	}, [exporting, i18n]);

	return (
		<div
			className={styles.deleteSection}
			data-flx="user.privacy-safety-tab.data-export-tab.data-export-tab-content.delete-section"
		>
			<Modal.Description
				className={styles.warningText}
				data-flx="user.privacy-safety-tab.data-export-tab.data-export-tab-content.warning-text"
			>
				{i18n._(EXPORT_TAB_DESCRIPTION)}
			</Modal.Description>
			{lastExportedAt && (
				<Modal.Description
					className={styles.warningText}
					data-flx="user.privacy-safety-tab.data-export-tab.data-export-tab-content.status"
				>
					<Trans>Your last export was generated on {DateUtils.getFormattedDateTime(lastExportedAt)}.</Trans>
				</Modal.Description>
			)}
			<Button
				variant="primary"
				submitting={exporting}
				disabled={exporting}
				onClick={handleExport}
				data-flx="user.privacy-safety-tab.data-export-tab.data-export-tab-content.button.open-modal"
			>
				<Trans>Export my data</Trans>
			</Button>
		</div>
	);
});
