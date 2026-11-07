// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import type {UserContactChangeLogRow} from '@app/api/database/types/UserTypes';

interface ContactChangeLogListParams {
	userId: UserID;
	limit: number;
	beforeEventId?: string;
}

interface ContactChangeLogInsertParams {
	userId: UserID;
	field: string;
	oldValue: string | null;
	newValue: string | null;
	reason: string;
	actorUserId: UserID | null;
	eventAt?: Date;
}

export class UserContactChangeLogRepository {
	async insertLog(_params: ContactChangeLogInsertParams): Promise<void> {}

	async listLogs(_params: ContactChangeLogListParams): Promise<Array<UserContactChangeLogRow>> {
		return [];
	}
}
