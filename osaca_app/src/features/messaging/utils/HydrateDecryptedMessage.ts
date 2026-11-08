// SPDX-License-Identifier: AGPL-3.0-or-later

import {localMessageSearchIndex} from '@app/features/search/state/LocalMessageSearchIndex';
import type {MessageEmbed} from '@osaca/schema/src/domains/message/EmbedSchemas';
import type {Message, MessageAttachment} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import type {MlsChatMessagePayload} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';
import {extractClientMentions} from './ClientMentionUtils';

export function hydrateDecryptedChatMessage(
	message: Partial<Message> & {content?: string; ciphertext?: string},
	payload: MlsChatMessagePayload,
): void {
	message.content = payload.content;

	const extracted = extractClientMentions(payload.content);
	(message as {mentions?: unknown}).mentions = extracted.mentions;
	(message as {mention_roles?: unknown}).mention_roles = extracted.mention_roles;
	(message as {mention_everyone?: unknown}).mention_everyone = extracted.mention_everyone;

	if (payload.attachments && payload.attachments.length > 0) {
		const existingAttachments = (message.attachments ?? []) as Array<MessageAttachment>;
		const hydratedAttachments = payload.attachments.map((encAtt, index) => {
			const existing = existingAttachments[index] ?? existingAttachments.find((a) => a.id === encAtt.id);
			return {
				id: existing?.id ?? encAtt.id,
				filename: encAtt.filename,
				content_type: encAtt.content_type,
				size: encAtt.size,
				url: existing?.url ?? encAtt.url ?? null,
				proxy_url: existing?.proxy_url ?? null,
				width: encAtt.width ?? existing?.width,
				height: encAtt.height ?? existing?.height,
				placeholder: encAtt.thumbhash ?? existing?.placeholder,
				flags: existing?.flags ?? 0,
				_mls_encrypted_attachment: encAtt,
			} as MessageAttachment;
		});
		(message as {attachments?: unknown}).attachments = hydratedAttachments;
	}

	if (payload.previews && payload.previews.length > 0) {
		const previewEmbeds: Array<MessageEmbed> = payload.previews.map((preview) => ({
			type: 'link',
			url: preview.url,
			title: preview.title,
			description: preview.description,
			provider: preview.site_name ? {name: preview.site_name} : undefined,
			thumbnail: preview.image
				? {
						url: preview.image.url,
						width: preview.image.width,
						height: preview.image.height,
						flags: 0,
					}
				: undefined,
		}));
		const currentEmbeds = (message.embeds ?? []) as Array<MessageEmbed>;
		(message as {embeds?: unknown}).embeds = [...currentEmbeds, ...previewEmbeds];
	}

	if (message.id && message.channel_id) {
		localMessageSearchIndex.indexMessage(message as Partial<Message> & {id: string; channel_id: string});
	}
}
