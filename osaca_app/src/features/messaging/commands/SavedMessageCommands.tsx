// SPDX-License-Identifier: AGPL-3.0-or-later

import * as InboxCommands from '@app/features/inbox/commands/InboxCommands';
import {SavedMessageEntry, type SavedMessageEntryWire} from '@app/features/messaging/models/SavedMessageEntry';
import Messages from '@app/features/messaging/state/MessagingMessages';
import SavedMessages from '@app/features/messaging/state/SavedMessages';
import {AppStorageKey} from '@app/features/platform/state/AppStorageKeys';
import AppStorage from '@app/features/platform/state/PersistentStorage';
import {Logger} from '@app/features/platform/utils/AppLogger';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';
import type {Message as WireMessage} from '@osaca/schema/src/domains/message/MessageResponseSchemas';

const ADDED_TO_BOOKMARKS_DESCRIPTOR = msg({
	message: 'Added to bookmarks',
	comment: 'Button or menu action label in the messaging commands. Keep it concise.',
});
const REMOVED_FROM_BOOKMARKS_DESCRIPTOR = msg({
	message: 'Removed from bookmarks',
	comment: 'Button or menu action label in the messaging commands. Keep it concise. Keep the tone plain and specific.',
});
const logger = new Logger('SavedMessages');

function loadLocalSavedEntries(): Array<SavedMessageEntryWire> {
	return AppStorage.getJSON<Array<SavedMessageEntryWire>>(AppStorageKey.SAVED_MESSAGES, []) ?? [];
}

function saveLocalSavedEntries(entries: Array<SavedMessageEntryWire>): void {
	AppStorage.setJSON(AppStorageKey.SAVED_MESSAGES, entries);
}

function savedMessageEntries(data: Array<SavedMessageEntryWire>): Array<SavedMessageEntry> {
	return data.map(SavedMessageEntry.fromResponse);
}

function showBookmarkToast(children: string): void {
	ToastCommands.createToast({
		type: 'success',
		children,
	});
}

export async function fetch(): Promise<Array<SavedMessageEntry>> {
	const requestId = SavedMessages.handleFetchPending();
	try {
		logger.debug('Loading saved messages from local storage');
		const raw = loadLocalSavedEntries();
		const entries = savedMessageEntries(raw);
		SavedMessages.fetchSuccess(requestId, entries, false);
		logger.debug(`Successfully loaded ${entries.length} local saved messages`);
		return entries;
	} catch (error) {
		SavedMessages.fetchError(requestId, false);
		logger.error('Failed to load local saved messages:', error);
		throw error;
	}
}

export async function loadMore(): Promise<Array<SavedMessageEntry>> {
	return [];
}

export async function create(i18n: I18n, channelId: string, messageId: string): Promise<void> {
	try {
		logger.debug(`Saving message ${messageId} from channel ${channelId} locally`);
		const stored = loadLocalSavedEntries();
		if (!stored.some((entry) => entry.message_id === messageId)) {
			const message = Messages.getMessage(channelId, messageId);
			const newEntry: SavedMessageEntryWire = {
				id: messageId,
				message_id: messageId,
				channel_id: channelId,
				status: 'available',
				message: (message?.toJSON() as WireMessage) ?? null,
			};
			stored.unshift(newEntry);
			saveLocalSavedEntries(stored);
			if (message) {
				SavedMessages.handleMessageCreate(message.toJSON() as WireMessage);
			}
		}
		showBookmarkToast(i18n._(ADDED_TO_BOOKMARKS_DESCRIPTOR));
		InboxCommands.revealBookmarksPopoutForFirstSave();
		logger.debug(`Successfully saved message ${messageId} locally`);
	} catch (error) {
		logger.error(`Failed to save message ${messageId} locally:`, error);
		throw error;
	}
}

export async function remove(i18n: I18n, messageId: string): Promise<void> {
	try {
		SavedMessages.handleMessageDelete(messageId);
		logger.debug(`Removing message ${messageId} from local saved messages`);
		const stored = loadLocalSavedEntries();
		const filtered = stored.filter((entry) => entry.message_id !== messageId);
		saveLocalSavedEntries(filtered);
		showBookmarkToast(i18n._(REMOVED_FROM_BOOKMARKS_DESCRIPTOR));
		logger.debug(`Successfully removed message ${messageId} locally`);
	} catch (error) {
		logger.error(`Failed to remove message ${messageId} locally:`, error);
		throw error;
	}
}
