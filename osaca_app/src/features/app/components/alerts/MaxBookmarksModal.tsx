// SPDX-License-Identifier: AGPL-3.0-or-later

import {GenericErrorModal} from '@app/features/app/components/alerts/GenericErrorModal';
import type {User} from '@app/features/user/models/User';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

const BOOKMARK_LIMIT_REACHED_DESCRIPTOR = msg({
	message: "You're at the bookmark limit",
	comment: 'Short label in the max bookmarks modal.',
});
const YOU_VE_REACHED_THE_MAXIMUM_NUMBER_OF_BOOKMARKS_DESCRIPTOR = msg({
	message:
		'You have {count, plural, one {# bookmark} other {# bookmarks}}, the most your instance admin allows. Remove one to add another.',
	comment: 'Modal body shown when the bookmarks limit is reached. {count} is the bookmark cap.',
});

interface MaxBookmarksModalProps {
	user: User;
}

export const MaxBookmarksModal = observer(({user}: MaxBookmarksModalProps) => {
	const {i18n} = useLingui();
	return (
		<GenericErrorModal
			title={i18n._(BOOKMARK_LIMIT_REACHED_DESCRIPTOR)}
			message={i18n._(YOU_VE_REACHED_THE_MAXIMUM_NUMBER_OF_BOOKMARKS_DESCRIPTOR, {count: user.maxBookmarks})}
			data-flx="app.max-bookmarks-modal.confirm-modal"
		/>
	);
});
