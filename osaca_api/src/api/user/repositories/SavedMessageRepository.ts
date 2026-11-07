// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ChannelID, MessageID, UserID} from '@app/api/BrandedTypes';
import {SavedMessage} from '@app/api/models/SavedMessage';

export class SavedMessageRepository {
	async countSavedMessages(_userId: UserID): Promise<number> {
		return 0;
	}

	async listSavedMessages(_userId: UserID, _limit: number = 25, _before?: MessageID): Promise<Array<SavedMessage>> {
		return [];
	}

	async createSavedMessage(userId: UserID, channelId: ChannelID, messageId: MessageID): Promise<SavedMessage> {
		return new SavedMessage({
			user_id: userId,
			channel_id: channelId,
			message_id: messageId,
			saved_at: new Date(),
		});
	}

	async deleteSavedMessage(_userId: UserID, _messageId: MessageID): Promise<void> {}

	async deleteAllSavedMessages(_userId: UserID): Promise<void> {}
}
