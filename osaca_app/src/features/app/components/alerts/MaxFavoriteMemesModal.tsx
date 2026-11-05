// SPDX-License-Identifier: AGPL-3.0-or-later

import {GenericErrorModal} from '@app/features/app/components/alerts/GenericErrorModal';
import Users from '@app/features/user/state/Users';
import {MAX_FAVORITE_MEMES} from '@osaca/constants/src/LimitConstants';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

const SAVED_MEDIA_LIMIT_REACHED_DESCRIPTOR = msg({
	message: "You're at the saved media limit",
	comment: 'Short label in the max favorite memes modal.',
});
const YOU_VE_REACHED_THE_MAXIMUM_LIMIT_OF_THIS_DESCRIPTOR = msg({
	message:
		'You have {count, plural, one {# saved media item} other {# saved media items}}, the most your instance admin allows.',
	comment: 'Modal body shown when the favorite-memes limit is reached. {count} is the saved media cap.',
});
export const MaxFavoriteMemesModal = observer(() => {
	const {i18n} = useLingui();
	const maxFavoriteMemes = Users.currentUser?.maxFavoriteMemes ?? MAX_FAVORITE_MEMES;
	return (
		<GenericErrorModal
			title={i18n._(SAVED_MEDIA_LIMIT_REACHED_DESCRIPTOR)}
			message={i18n._(YOU_VE_REACHED_THE_MAXIMUM_LIMIT_OF_THIS_DESCRIPTOR, {count: maxFavoriteMemes})}
			data-flx="app.max-favorite-memes-modal.confirm-modal"
		/>
	);
});
