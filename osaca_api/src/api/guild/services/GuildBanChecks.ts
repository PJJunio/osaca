// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, UserID} from '@app/api/BrandedTypes';
import type {GuildRepository} from '@app/api/guild/repositories/GuildRepository';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import {BannedFromGuildError} from '@osaca/errors/src/domains/guild/BannedFromGuildError';

export async function assertNotBannedFromGuild(
	guildRepository: GuildRepository,
	_userRepository: UserRepository,
	params: {userId: UserID; guildId: GuildID},
): Promise<void> {
	const {userId, guildId} = params;
	const bans = await guildRepository.listBans(guildId);
	for (const ban of bans) {
		if (ban.userId === userId) throw new BannedFromGuildError();
	}
}
