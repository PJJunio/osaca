// SPDX-License-Identifier: AGPL-3.0-or-later

import type {PasswordResetToken as PasswordResetTokenBrand, UserID} from '@app/api/BrandedTypes';
import {BatchBuilder, fetchMany, fetchOne} from '@app/api/database/CassandraQueryExecution';
import type {PasswordResetTokenRow} from '@app/api/database/types/AuthTypes';
import {PasswordResetToken} from '@app/api/models/PasswordResetToken';
import {PasswordResetTokens, PasswordResetTokensByUserId} from '@app/api/Tables';
import {seconds} from 'itty-time';

const FETCH_PASSWORD_RESET_TOKEN_CQL = PasswordResetTokens.selectCql({
	where: PasswordResetTokens.where.eq('token_'),
	limit: 1,
});
const FETCH_PASSWORD_RESET_TOKENS_BY_USER_CQL = PasswordResetTokensByUserId.selectCql({
	where: PasswordResetTokensByUserId.where.eq('user_id'),
});
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = seconds('1 hour');

export class TokenRepository {
	async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
		const tokenRow = await fetchOne<PasswordResetTokenRow>(FETCH_PASSWORD_RESET_TOKEN_CQL, {token_: token});
		return tokenRow ? new PasswordResetToken(tokenRow) : null;
	}

	async createPasswordResetToken(tokenData: PasswordResetTokenRow): Promise<PasswordResetToken> {
		const batch = new BatchBuilder();
		batch.addPrepared(PasswordResetTokens.insertWithTtl(tokenData, PASSWORD_RESET_TOKEN_TTL_SECONDS));
		batch.addPrepared(
			PasswordResetTokensByUserId.insertWithTtl(
				{user_id: tokenData.user_id, token_: tokenData.token_},
				PASSWORD_RESET_TOKEN_TTL_SECONDS,
			),
		);
		await batch.execute();
		return new PasswordResetToken(tokenData);
	}

	async deleteAllPasswordResetTokens(userId: UserID): Promise<void> {
		const tokens = await fetchMany<{
			user_id: UserID;
			token_: PasswordResetTokenBrand;
		}>(FETCH_PASSWORD_RESET_TOKENS_BY_USER_CQL, {
			user_id: userId,
		});
		if (tokens.length === 0) return;
		const batch = new BatchBuilder();
		for (const token of tokens) {
			batch.addPrepared(PasswordResetTokens.deleteByPk({token_: token.token_, user_id: userId}));
			batch.addPrepared(PasswordResetTokensByUserId.deleteByPk({user_id: userId, token_: token.token_}));
		}
		await batch.execute();
	}
}
