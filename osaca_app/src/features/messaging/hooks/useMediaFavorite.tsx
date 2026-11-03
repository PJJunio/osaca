// SPDX-License-Identifier: AGPL-3.0-or-later

import * as FavoriteMemeCommands from '@app/features/expressions/commands/FavoriteMemeCommands';
import {AddFavoriteMemeModal} from '@app/features/expressions/components/modals/AddFavoriteMemeModal';
import FavoriteMemes from '@app/features/expressions/state/FavoriteMemes';
import * as FavoriteMemeUtils from '@app/features/expressions/utils/FavoriteMemeUtils';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import {useLingui} from '@lingui/react/macro';
import {autorun} from 'mobx';
import {useCallback, useSyncExternalStore} from 'react';

interface UseMediaFavoriteParams {
	channelId?: string;
	messageId?: string;
	attachmentId?: string;
	embedIndex?: number;
	defaultName?: string;
	defaultAltText?: string;
	contentHash?: string | null;
	isGifv?: boolean;
	gifSlug?: string | null;
	gifProvider?: string | null;
	embedURL?: string;
	proxyURL?: string;
	naturalWidth?: number;
	naturalHeight?: number;
}

interface UseMediaFavoriteReturn {
	isFavorited: boolean;
	toggleFavorite: (e?: React.MouseEvent) => Promise<void>;
	canFavorite: boolean;
}

export function useMediaFavorite({
	channelId,
	messageId,
	attachmentId,
	embedIndex,
	defaultName,
	defaultAltText,
	contentHash,
	gifSlug,
	gifProvider,
}: UseMediaFavoriteParams): UseMediaFavoriteReturn {
	const {i18n} = useLingui();
	const memes = useSyncExternalStore(
		(listener) => {
			const dispose = autorun(listener);
			return () => dispose();
		},
		() => FavoriteMemes.memes,
	);
	const hasSavedMediaFavorite = FavoriteMemeUtils.isFavorited(memes, {contentHash, gifSlug, gifProvider});
	const isFavorited = hasSavedMediaFavorite;
	const canFavorite = !!(channelId && messageId && (attachmentId || embedIndex !== undefined));
	const toggleFavorite = useCallback(
		async (e?: React.MouseEvent) => {
			e?.stopPropagation();
			if (!canFavorite) return;
			if (isFavorited) {
				const meme = FavoriteMemeUtils.findFavoritedMeme(memes, {contentHash, gifSlug, gifProvider});
				if (!meme) return;
				await FavoriteMemeCommands.deleteFavoriteMeme(i18n, meme.id);
			} else {
				ModalCommands.push(
					modal(() => (
						<AddFavoriteMemeModal
							channelId={channelId!}
							messageId={messageId!}
							attachmentId={attachmentId}
							embedIndex={embedIndex}
							defaultName={defaultName}
							defaultAltText={defaultAltText}
							data-flx="messaging.use-media-favorite.toggle-favorite.add-favorite-meme-modal"
						/>
					)),
				);
			}
		},
		[
			canFavorite,
			isFavorited,
			contentHash,
			gifSlug,
			gifProvider,
			memes,
			channelId,
			messageId,
			attachmentId,
			embedIndex,
			defaultName,
			defaultAltText,
			i18n,
		],
	);
	return {
		isFavorited,
		toggleFavorite,
		canFavorite,
	};
}
