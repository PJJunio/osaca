// SPDX-License-Identifier: AGPL-3.0-or-later

import {AppStorageKey} from '@app/features/platform/state/AppStorageKeys';
import AppStorage from '@app/features/platform/state/PersistentStorage';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {ChannelTypes} from '@osaca/constants/src/ChannelConstants';
import type {Channel as WireChannel} from '@osaca/schema/src/domains/channel/ChannelSchemas';
import type {MessageEmbed} from '@osaca/schema/src/domains/message/EmbedSchemas';
import type {MessageAttachment, Message as WireMessage} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import type {UserPartial} from '@osaca/schema/src/domains/user/UserResponseSchemas';

const logger = new Logger('LocalMessageSearchIndex');

export type MessageSearchCategory =
	| 'image'
	| 'sound'
	| 'video'
	| 'file'
	| 'sticker'
	| 'embed'
	| 'link'
	| 'poll'
	| 'snapshot';

export interface LocalIndexedMessage {
	id: string;
	channel_id: string;
	author_id: string;
	author?: {
		id: string;
		username: string;
		discriminator?: number | string;
		avatar?: string | null;
		global_name?: string | null;
	};
	content: string;
	timestamp: string;
	edited_timestamp?: string | null;
	pinned?: boolean;
	has: Array<MessageSearchCategory>;
	attachments?: Array<MessageAttachment>;
	embeds?: Array<MessageEmbed>;
	mentions?: Array<string>;
	mention_everyone?: boolean;
	ciphertext?: string;
}

export interface LocalSearchQueryContext {
	contextChannelId?: string;
	contextGuildId?: string | null;
}

export interface LocalSearchParams {
	hitsPerPage?: number;
	page?: number;
	maxId?: string;
	minId?: string;
	content?: string;
	contents?: Array<string>;
	exactPhrases?: Array<string>;
	channelId?: Array<string>;
	excludeChannelId?: Array<string>;
	authorId?: Array<string>;
	excludeAuthorId?: Array<string>;
	mentions?: Array<string>;
	excludeMentions?: Array<string>;
	mentionEveryone?: boolean;
	pinned?: boolean;
	has?: Array<MessageSearchCategory>;
	excludeHas?: Array<MessageSearchCategory>;
	sortBy?: 'timestamp' | 'relevance';
	sortOrder?: 'asc' | 'desc';
	scope?: string;
}

export interface LocalSearchResult {
	messages: Array<WireMessage>;
	channels: Array<WireChannel>;
	total: number;
	hitsPerPage: number;
	page: number;
}

export function extractMessageHasFlags(message: {
	content?: string;
	attachments?: Array<{filename?: string; content_type?: string}>;
	embeds?: Array<{type?: string; url?: string}>;
	stickers?: Array<unknown>;
	poll?: unknown;
}): Array<MessageSearchCategory> {
	const has = new Set<MessageSearchCategory>();
	if (message.attachments && message.attachments.length > 0) {
		has.add('file');
		for (const att of message.attachments) {
			const ct = (att.content_type ?? '').toLowerCase();
			if (ct.startsWith('image/')) has.add('image');
			else if (ct.startsWith('video/')) has.add('video');
			else if (ct.startsWith('audio/')) has.add('sound');
		}
	}
	if (message.embeds && message.embeds.length > 0) {
		has.add('embed');
		for (const embed of message.embeds) {
			if (embed.type === 'image') has.add('image');
			else if (embed.type === 'video') has.add('video');
			else if (embed.type === 'link') has.add('link');
		}
	}
	if (message.content && /https?:\/\//i.test(message.content)) {
		has.add('link');
	}
	if (message.stickers && message.stickers.length > 0) {
		has.add('sticker');
	}
	if (message.poll) {
		has.add('poll');
	}
	return Array.from(has);
}

function toWireMessage(indexed: LocalIndexedMessage): WireMessage {
	return {
		id: indexed.id,
		channel_id: indexed.channel_id,
		content: indexed.content,
		author: (indexed.author ?? {
			id: indexed.author_id,
			username: 'User',
			discriminator: 0,
			avatar: null,
		}) as unknown as UserPartial,
		timestamp: indexed.timestamp,
		edited_timestamp: indexed.edited_timestamp ?? null,
		pinned: indexed.pinned ?? false,
		mention_everyone: indexed.mention_everyone ?? false,
		mentions: (indexed.mentions ?? []).map((id) => ({id})) as unknown as Array<UserPartial>,
		attachments: (indexed.attachments ?? []) as Array<MessageAttachment>,
		embeds: (indexed.embeds ?? []) as Array<MessageEmbed>,
		type: 0,
		flags: 0,
		tts: false,
	} as unknown as WireMessage;
}

export class LocalMessageSearchIndex {
	private hydrated = false;
	private messagesById = new Map<string, LocalIndexedMessage>();
	private messagesByChannelId = new Map<string, Set<string>>();

	private ensureHydrated(): void {
		if (this.hydrated) return;
		this.hydrated = true;
		try {
			const stored = AppStorage.getJSON<Array<LocalIndexedMessage>>(AppStorageKey.MLS_SEARCH_INDEX, []) ?? [];
			for (const msg of stored) {
				this.messagesById.set(msg.id, msg);
				let channelSet = this.messagesByChannelId.get(msg.channel_id);
				if (!channelSet) {
					channelSet = new Set();
					this.messagesByChannelId.set(msg.channel_id, channelSet);
				}
				channelSet.add(msg.id);
			}
		} catch (error) {
			logger.warn('Failed to load local message search index from storage', error);
		}
	}

	private persist(): void {
		try {
			const all = Array.from(this.messagesById.values());
			AppStorage.setJSON(AppStorageKey.MLS_SEARCH_INDEX, all);
		} catch (error) {
			logger.warn('Failed to persist local message search index', error);
		}
	}

	indexMessage(
		message: Omit<Partial<WireMessage>, 'author'> & {
			id: string;
			channel_id: string;
			author?:
				| Partial<UserPartial>
				| {
						id: string;
						username: string;
						discriminator?: number | string;
						avatar?: string | null;
						global_name?: string | null;
				  };
		},
	): void {
		this.ensureHydrated();
		const id = String(message.id);
		const channelId = String(message.channel_id);
		const authorId = message.author?.id ?? '';
		const author = message.author
			? {
					id: message.author.id ?? authorId ?? '',
					username: message.author.username ?? 'User',
					discriminator: message.author.discriminator ?? 0,
					avatar: message.author.avatar ?? null,
					global_name: (message.author as {global_name?: string | null}).global_name ?? null,
				}
			: undefined;

		const existing = this.messagesById.get(id);
		const content = message.content !== undefined ? message.content : (existing?.content ?? '');
		const attachments = message.attachments !== undefined ? message.attachments : (existing?.attachments ?? []);
		const embeds = message.embeds !== undefined ? message.embeds : (existing?.embeds ?? []);
		const pinned = message.pinned !== undefined ? Boolean(message.pinned) : (existing?.pinned ?? false);
		const timestamp = message.timestamp ?? existing?.timestamp ?? new Date().toISOString();
		const editedTimestamp =
			message.edited_timestamp !== undefined ? message.edited_timestamp : (existing?.edited_timestamp ?? null);

		const mentions = message.mentions
			? message.mentions.map((m: unknown) => (typeof m === 'string' ? m : (m as {id: string}).id))
			: (existing?.mentions ?? []);

		const has = extractMessageHasFlags({
			content,
			attachments: attachments as unknown as Array<{filename?: string; content_type?: string}>,
			embeds: embeds as unknown as Array<{type?: string; url?: string}>,
		});

		const indexed: LocalIndexedMessage = {
			id,
			channel_id: channelId,
			author_id: authorId || (existing?.author_id ?? ''),
			author: author ?? existing?.author,
			content,
			timestamp,
			edited_timestamp: editedTimestamp,
			pinned,
			has,
			attachments: attachments as Array<MessageAttachment>,
			embeds: embeds as Array<MessageEmbed>,
			mentions,
			mention_everyone: message.mention_everyone ?? existing?.mention_everyone ?? false,
			ciphertext: (message as {ciphertext?: string}).ciphertext ?? existing?.ciphertext,
		};

		this.messagesById.set(id, indexed);
		let channelSet = this.messagesByChannelId.get(channelId);
		if (!channelSet) {
			channelSet = new Set();
			this.messagesByChannelId.set(channelId, channelSet);
		}
		channelSet.add(id);
		this.persist();
	}

	indexMessages(
		messages: Array<
			Omit<Partial<WireMessage>, 'author'> & {
				id: string;
				channel_id: string;
				author?:
					| Partial<UserPartial>
					| {
							id: string;
							username: string;
							discriminator?: number | string;
							avatar?: string | null;
							global_name?: string | null;
					  };
			}
		>,
	): void {
		for (const msg of messages) {
			this.indexMessage(msg);
		}
	}

	updateMessage(channelId: string, messageId: string, updates: Partial<WireMessage>): void {
		this.ensureHydrated();
		const existing = this.messagesById.get(messageId);
		if (!existing) return;
		this.indexMessage({
			...(toWireMessage(existing) as unknown as Partial<WireMessage>),
			...updates,
			id: messageId,
			channel_id: channelId,
		});
	}

	removeMessage(channelId: string, messageId: string): void {
		this.ensureHydrated();
		this.messagesById.delete(messageId);
		const channelSet = this.messagesByChannelId.get(channelId);
		if (channelSet) {
			channelSet.delete(messageId);
			if (channelSet.size === 0) {
				this.messagesByChannelId.delete(channelId);
			}
		}
		this.persist();
	}

	removeChannelMessages(channelId: string): void {
		this.ensureHydrated();
		const channelSet = this.messagesByChannelId.get(channelId);
		if (channelSet) {
			for (const id of channelSet) {
				this.messagesById.delete(id);
			}
			this.messagesByChannelId.delete(channelId);
		}
		this.persist();
	}

	getAllMessages(): Array<LocalIndexedMessage> {
		this.ensureHydrated();
		return Array.from(this.messagesById.values());
	}

	getMessage(messageId: string): LocalIndexedMessage | undefined {
		this.ensureHydrated();
		return this.messagesById.get(messageId);
	}

	clear(): void {
		this.messagesById.clear();
		this.messagesByChannelId.clear();
		this.hydrated = true;
		try {
			AppStorage.removeItem(AppStorageKey.MLS_SEARCH_INDEX);
		} catch (error) {
			logger.warn('Failed to clear local message search index', error);
		}
	}

	search(context: LocalSearchQueryContext, params: LocalSearchParams): LocalSearchResult {
		this.ensureHydrated();
		let candidates: Array<LocalIndexedMessage>;

		const isCurrentScope = params.scope === 'current' || (!params.scope && Boolean(context.contextChannelId));
		if (isCurrentScope && context.contextChannelId) {
			const channelMsgIds = this.messagesByChannelId.get(context.contextChannelId);
			candidates = channelMsgIds
				? Array.from(channelMsgIds)
						.map((id) => this.messagesById.get(id)!)
						.filter(Boolean)
				: [];
		} else if (params.channelId && params.channelId.length > 0) {
			candidates = [];
			for (const chId of params.channelId) {
				const channelMsgIds = this.messagesByChannelId.get(chId);
				if (channelMsgIds) {
					for (const id of channelMsgIds) {
						const msg = this.messagesById.get(id);
						if (msg) candidates.push(msg);
					}
				}
			}
		} else {
			candidates = Array.from(this.messagesById.values());
		}

		const filtered = candidates.filter((msg) => {
			if (params.excludeChannelId?.includes(msg.channel_id)) {
				return false;
			}
			if (params.authorId && params.authorId.length > 0 && !params.authorId.includes(msg.author_id)) {
				return false;
			}
			if (
				params.excludeAuthorId &&
				params.excludeAuthorId.length > 0 &&
				params.excludeAuthorId.includes(msg.author_id)
			) {
				return false;
			}
			if (params.pinned !== undefined && Boolean(msg.pinned) !== params.pinned) {
				return false;
			}
			if (params.minId && BigInt(msg.id) <= BigInt(params.minId)) {
				return false;
			}
			if (params.maxId && BigInt(msg.id) >= BigInt(params.maxId)) {
				return false;
			}
			if (params.has && params.has.length > 0) {
				const hasAll = params.has.every((category) => msg.has.includes(category));
				if (!hasAll) return false;
			}
			if (params.excludeHas && params.excludeHas.length > 0) {
				const hasExcluded = params.excludeHas.some((category) => msg.has.includes(category));
				if (hasExcluded) return false;
			}
			if (params.mentions && params.mentions.length > 0) {
				const hasMention = msg.mentions?.some((m) => params.mentions!.includes(m));
				if (!hasMention) return false;
			}
			if (params.excludeMentions && params.excludeMentions.length > 0) {
				const hasExcludedMention = msg.mentions?.some((m) => params.excludeMentions!.includes(m));
				if (hasExcludedMention) return false;
			}

			// Text and exact phrase query matching
			const contentLower = msg.content.toLowerCase();
			const attachmentFilenamesLower = (msg.attachments ?? []).map((a) => (a.filename ?? '').toLowerCase());

			if (params.exactPhrases && params.exactPhrases.length > 0) {
				for (const phrase of params.exactPhrases) {
					if (!contentLower.includes(phrase.toLowerCase())) {
						return false;
					}
				}
			}

			if (params.content && params.content.trim().length > 0) {
				const tokens = params.content
					.trim()
					.toLowerCase()
					.split(/\s+/)
					.filter((t) => t.length > 0);
				for (const token of tokens) {
					const matchedInContent = contentLower.includes(token);
					const matchedInAttachment = attachmentFilenamesLower.some((name) => name.includes(token));
					if (!matchedInContent && !matchedInAttachment) {
						return false;
					}
				}
			}

			if (params.contents && params.contents.length > 0) {
				for (const token of params.contents) {
					const tokenLower = token.toLowerCase();
					const matchedInContent = contentLower.includes(tokenLower);
					const matchedInAttachment = attachmentFilenamesLower.some((name) => name.includes(tokenLower));
					if (!matchedInContent && !matchedInAttachment) {
						return false;
					}
				}
			}

			return true;
		});

		// Sorting
		if (params.sortBy === 'relevance' && params.content) {
			const queryTokens = params.content.toLowerCase().split(/\s+/).filter(Boolean);
			filtered.sort((a, b) => {
				const aContent = a.content.toLowerCase();
				const bContent = b.content.toLowerCase();
				let aScore = 0;
				let bScore = 0;
				for (const token of queryTokens) {
					if (aContent.includes(token)) aScore += 10;
					if (bContent.includes(token)) bScore += 10;
				}
				if (aScore !== bScore) return bScore - aScore;
				return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
			});
		} else {
			const sortOrder = params.sortOrder ?? 'desc';
			filtered.sort((a, b) => {
				const timeA = new Date(a.timestamp).getTime();
				const timeB = new Date(b.timestamp).getTime();
				return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
			});
		}

		const total = filtered.length;
		const hitsPerPage = params.hitsPerPage ?? 25;
		const page = params.page ?? 1;
		const startIndex = (page - 1) * hitsPerPage;
		const paged = filtered.slice(startIndex, startIndex + hitsPerPage);

		const resultMessages = paged.map((indexed) => toWireMessage(indexed));

		const channelIds = Array.from(new Set(paged.map((m) => m.channel_id)));
		const resultChannels = channelIds.map(
			(chId) =>
				({
					id: chId,
					type: ChannelTypes.DM,
					name: 'Direct Message',
				}) as unknown as WireChannel,
		);

		return {
			messages: resultMessages,
			channels: resultChannels,
			total,
			hitsPerPage,
			page,
		};
	}
}

export const localMessageSearchIndex = new LocalMessageSearchIndex();
