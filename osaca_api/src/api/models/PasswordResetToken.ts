// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {createPasswordResetToken} from '@app/api/BrandedTypes';
import type {PasswordResetTokenRow} from '@app/api/database/types/AuthTypes';

export class PasswordResetToken {
	readonly token: string;
	readonly userId: UserID;

	constructor(row: PasswordResetTokenRow) {
		this.token = row.token_;
		this.userId = row.user_id;
	}

	toRow(): PasswordResetTokenRow {
		return {
			token_: createPasswordResetToken(this.token),
			user_id: this.userId,
		};
	}
}
