// SPDX-License-Identifier: AGPL-3.0-or-later

import {GenericErrorModal} from '@app/features/app/components/alerts/GenericErrorModal';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {SafeMarkdown} from '@app/features/messaging/components/markdown';
import {MarkdownContext} from '@app/features/messaging/components/markdown/renderers/RendererTypes';
import {formatFileSize} from '@app/features/messaging/utils/FileUtils';
import markupStyles from '@app/features/theme/styles/Markup.module.css';
import Users from '@app/features/user/state/Users';
import {ATTACHMENT_MAX_SIZE} from '@osaca/constants/src/LimitConstants';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

const SOME_FILES_YOU_RE_TRYING_TO_UPLOAD_EXCEED_DESCRIPTOR = msg({
	message: "Some files you're trying to upload exceed the maximum size limit of {maxSizeFormatted} per file.",
	comment:
		'Body of the file-too-large alert when multiple files exceed the per-file size limit. maxSizeFormatted is the limit formatted with units.',
});
const THE_FILE_YOU_RE_TRYING_TO_UPLOAD_EXCEEDS_DESCRIPTOR = msg({
	message: "The file you're trying to upload exceeds the maximum size limit of {maxSizeFormatted}.",
	comment: 'Body of the file-too-large alert when a single file exceeds the per-file size limit.',
});
const ONE_OR_MORE_FILES_YOU_RE_TRYING_TO_DESCRIPTOR = msg({
	message: "One or more files you're trying to upload exceed the maximum size limit of {maxSizeFormatted} per file.",
	comment: 'Body of the file-too-large alert for ambiguous count (single or multiple) over the per-file size limit.',
});
const FILE_SIZE_TOO_LARGE_DESCRIPTOR = msg({
	message: 'File size too large',
	comment: 'Title of the file-too-large alert.',
});
const INSTANCE_ADMIN_LIMIT_DESCRIPTOR = msg({
	message: 'This limit is configured by your instance administrator.',
	comment: 'Extra file-too-large alert sentence shown when the instance sets no custom upload limit message.',
});

function withInstanceNote(description: string, note: string | null): React.ReactNode {
	if (!note) return description;
	return (
		<>
			<span data-flx="messaging.file-size-too-large-modal.description">{description}</span>
			<div className={markupStyles.markup} data-flx="messaging.file-size-too-large-modal.instance-note">
				<SafeMarkdown
					content={note}
					options={{context: MarkdownContext.RESTRICTED_EMBED_DESCRIPTION, disableEmojiInfoCard: true}}
					data-flx="messaging.file-size-too-large-modal.instance-note-markdown"
				/>
			</div>
		</>
	);
}

interface FileSizeTooLargeModalProps {
	oversizedFileCount?: number;
}

export const FileSizeTooLargeModal = observer(({oversizedFileCount}: FileSizeTooLargeModalProps) => {
	const {i18n} = useLingui();
	const user = Users.currentUser;
	const maxAttachmentFileSize = user?.maxAttachmentFileSize ?? ATTACHMENT_MAX_SIZE;
	const maxSizeFormatted = formatFileSize(i18n.locale, maxAttachmentFileSize);
	const hasKnownOversizedFileCount = oversizedFileCount != null;
	const hasMultipleOversizedFiles = (oversizedFileCount ?? 0) > 1;
	const instanceNote = RuntimeConfig.appPublic.branding.upload_limit_message;
	let baseDescription: string;
	if (!hasKnownOversizedFileCount) {
		baseDescription = i18n._(ONE_OR_MORE_FILES_YOU_RE_TRYING_TO_DESCRIPTOR, {maxSizeFormatted});
	} else if (hasMultipleOversizedFiles) {
		baseDescription = i18n._(SOME_FILES_YOU_RE_TRYING_TO_UPLOAD_EXCEED_DESCRIPTOR, {maxSizeFormatted});
	} else {
		baseDescription = i18n._(THE_FILE_YOU_RE_TRYING_TO_UPLOAD_EXCEEDS_DESCRIPTOR, {maxSizeFormatted});
	}
	const message = instanceNote
		? withInstanceNote(baseDescription, instanceNote)
		: `${baseDescription} ${i18n._(INSTANCE_ADMIN_LIMIT_DESCRIPTOR)}`;
	return (
		<GenericErrorModal
			title={i18n._(FILE_SIZE_TOO_LARGE_DESCRIPTOR)}
			message={message}
			data-flx="messaging.file-size-too-large-modal.confirm-modal"
		/>
	);
});
