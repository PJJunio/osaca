// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ChannelWire} from '@app/features/channel/models/Channel';
import type {PresenceRecord} from '@app/features/gateway/types/GatewayPresenceTypes';
import type {VoiceState} from '@app/features/gateway/types/GatewayVoiceTypes';
import type {Channel} from '@osaca/schema/src/domains/channel/ChannelSchemas';
import type {GuildEmoji, GuildSticker} from '@osaca/schema/src/domains/guild/GuildEmojiSchemas';
import type {GuildMemberData} from '@osaca/schema/src/domains/guild/GuildMemberSchemas';
import type {Guild} from '@osaca/schema/src/domains/guild/GuildResponseSchemas';
import type {GuildRole} from '@osaca/schema/src/domains/guild/GuildRoleSchemas';

export type GuildReadyData = Readonly<{
	id: string;
	properties: Omit<Guild, 'roles'>;
	channels: ReadonlyArray<Channel>;
	threads?: ReadonlyArray<ChannelWire>;
	emojis: ReadonlyArray<GuildEmoji>;
	stickers?: ReadonlyArray<GuildSticker>;
	members: ReadonlyArray<GuildMemberData>;
	member_count: number;
	online_count?: number;
	presences?: ReadonlyArray<PresenceRecord>;
	voice_states?: ReadonlyArray<VoiceState>;
	roles: ReadonlyArray<GuildRole>;
	joined_at: string | null;
	unavailable?: boolean;
	visiting?: boolean;
	unavailable_hidden?: boolean;
	degraded?: boolean;
}>;
