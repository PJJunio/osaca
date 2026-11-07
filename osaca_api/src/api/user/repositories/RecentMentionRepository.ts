// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MessageID, UserID} from '@app/api/BrandedTypes';
import type {RecentMentionRow} from '@app/api/database/types/UserTypes';
import type {RecentMention} from '@app/api/models/RecentMention';

export class RecentMentionRepository {
	async getRecentMention(_userId: UserID, _messageId: MessageID): Promise<RecentMention | null> {
		return null;
	}

	async listRecentMentions(
		_userId: UserID,
		_includeEveryone: boolean = true,
		_includeRole: boolean = true,
		_includeGuilds: boolean = true,
		_limit: number = 25,
		_before?: MessageID,
	): Promise<Array<RecentMention>> {
		return [];
	}

	async createRecentMentions(_mentions: Array<RecentMentionRow>): Promise<void> {}

	async deleteRecentMention(_mention: RecentMention): Promise<void> {}

	async deleteRecentMentions(_mentions: Array<RecentMention>): Promise<void> {}

	async deleteAllRecentMentions(_userId: UserID): Promise<void> {}
}
