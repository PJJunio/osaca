// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {statusError} from '@osaca/errors/src/OsacaError';

export class MlsGroupNotFoundError extends statusError(404) {
	constructor(groupId?: string) {
		super({
			code: APIErrorCodes.MLS_GROUP_NOT_FOUND,
			message: groupId ? `MLS group not found: ${groupId}` : 'MLS group not found',
			data: groupId ? {group_id: groupId} : undefined,
		});
	}
}
