// SPDX-License-Identifier: AGPL-3.0-or-later

import {registerSenderLinkPreviewsSettingGetter} from '@app/features/messaging/utils/ClientLinkPreviewUtils';
import {AppStorageKey} from '@app/features/platform/state/AppStorageKeys';
import AppStorage from '@app/features/platform/state/PersistentStorage';
import {initializeStore} from '@app/features/platform/utils/StoreInitialization';
import {makeSyncedField} from '@app/features/user/state/SyncedField';
import Users from '@app/features/user/state/Users';
import {PrivacyPreferencesSchema} from '@osaca/schema/src/gen/osaca/user/preferences/v1/preferences_pb';
import {extractTimestamp} from '@osaca/snowflake/src/SnowflakeUtils';
import {makeAutoObservable} from 'mobx';

const SHOW_ACTIVE_NOW_DEFAULT = true;
const PREUPLOAD_MESSAGE_ATTACHMENTS_DEFAULT_ON_AFTER = '2026-06-04T16:10:00.000Z';
const PREUPLOAD_MESSAGE_ATTACHMENTS_DEFAULT_ON_AFTER_MS = Date.parse(PREUPLOAD_MESSAGE_ATTACHMENTS_DEFAULT_ON_AFTER);

function getPreuploadMessageAttachmentsDefaultForUserId(userId: string | null | undefined): boolean {
	if (!userId) {
		return false;
	}
	const createdAtMs = extractTimestamp(userId);
	return Number.isFinite(createdAtMs) && createdAtMs >= PREUPLOAD_MESSAGE_ATTACHMENTS_DEFAULT_ON_AFTER_MS;
}

function currentUserIdSafe(): string | null | undefined {
	return (Users as typeof Users | undefined)?.currentUserId;
}

class PrivacyPreferences {
	disableStreamPreviews = false;
	showActiveNow = SHOW_ACTIVE_NOW_DEFAULT;
	preuploadMessageAttachments: boolean | undefined = undefined;
	senderLinkPreviews = false;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
		registerSenderLinkPreviewsSettingGetter(() => this.getSenderLinkPreviews());
		initializeStore(this, () => this.initPersistence());
	}

	private async initPersistence(): Promise<void> {
		const storedSenderLinkPreviews = AppStorage.getItem(AppStorageKey.SENDER_LINK_PREVIEWS);
		if (storedSenderLinkPreviews !== null) {
			this.senderLinkPreviews = storedSenderLinkPreviews === 'true';
		}

		await makeSyncedField(this, {
			field: 'privacy',
			schema: PrivacyPreferencesSchema,
			persist: ['disableStreamPreviews', 'showActiveNow', 'preuploadMessageAttachments'],
			toMessage: (s) => ({
				disableStreamPreviews: s.disableStreamPreviews,
				showActiveNow: s.showActiveNow === SHOW_ACTIVE_NOW_DEFAULT ? undefined : s.showActiveNow,
				preuploadMessageAttachments:
					s.preuploadMessageAttachments === getPreuploadMessageAttachmentsDefaultForUserId(currentUserIdSafe())
						? undefined
						: s.preuploadMessageAttachments,
			}),
			applyMessage: (s, m) => {
				s.disableStreamPreviews = m.disableStreamPreviews;
				if (m.showActiveNow !== undefined) {
					s.showActiveNow = m.showActiveNow;
				}
				s.preuploadMessageAttachments = m.preuploadMessageAttachments;
			},
		});
	}

	getDisableStreamPreviews(): boolean {
		return this.disableStreamPreviews;
	}

	getShowActiveNow(): boolean {
		return this.showActiveNow;
	}

	getPreuploadMessageAttachments(): boolean {
		return this.preuploadMessageAttachments ?? getPreuploadMessageAttachmentsDefaultForUserId(currentUserIdSafe());
	}

	getSenderLinkPreviews(): boolean {
		return this.senderLinkPreviews;
	}

	setDisableStreamPreviews(value: boolean): void {
		this.disableStreamPreviews = value;
	}

	setShowActiveNow(value: boolean): void {
		this.showActiveNow = value;
	}

	setPreuploadMessageAttachments(value: boolean): void {
		const defaultValue = getPreuploadMessageAttachmentsDefaultForUserId(currentUserIdSafe());
		this.preuploadMessageAttachments = value === defaultValue ? undefined : value;
	}

	setSenderLinkPreviews(value: boolean): void {
		this.senderLinkPreviews = value;
		AppStorage.setItem(AppStorageKey.SENDER_LINK_PREVIEWS, value ? 'true' : 'false');
	}
}

export default new PrivacyPreferences();
