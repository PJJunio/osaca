// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash} from 'node:crypto';

export interface ModerationContext {
	userId: bigint | null;
	guildId: bigint | null;
	channelId: bigint | null;
	messageId: bigint | null;
	surface:
		| 'message_content'
		| 'message_attachment'
		| 'message_embed_unfurl'
		| 'avatar'
		| 'banner'
		| 'guild_icon'
		| 'guild_splash'
		| 'guild_banner'
		| 'emoji'
		| 'sticker'
		| 'app_asset'
		| 'profile_field'
		| 'webhook'
		| 'oauth_redirect';
}

class ContentModerationService {
	scanText(_text: string | null | undefined, _ctx: ModerationContext): void {}

	scanUrl(_url: string, _ctx: ModerationContext): void {}

	scanFileBuffer(buffer: Buffer | Uint8Array, _ctx: ModerationContext): string {
		return createHash('sha256').update(buffer).digest('hex');
	}

	scanSha256(_sha: string, _ctx: ModerationContext): void {}
}

export const contentModerationService = new ContentModerationService();
