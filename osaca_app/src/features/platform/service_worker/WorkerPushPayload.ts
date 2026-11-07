// SPDX-License-Identifier: AGPL-3.0-or-later

import {PRODUCT_NAME} from '@app/features/app/config/ProductConstants';
import {isObjectLike as isRecord} from '@osaca/record_utils/src/RecordGuards';

export interface PushPayload {
	type?: string;
	action?: string;
	title?: string;
	body?: string;
	icon?: string;
	badge?: string;
	tag?: string;
	data?: Record<string, unknown>;
	notification?: PushPayload;
	web_push?: number;
}

export interface PushNotificationClientState {
	hasWindowClient: boolean;
	hasVisibleClient: boolean;
}

export const normalizePushPayload = (raw: unknown): PushPayload => {
	const payload = (raw ?? {}) as PushPayload;
	if (payload.web_push === 8030 && payload.notification && typeof payload.notification === 'object') {
		const inner = payload.notification;
		const navigateUrl = (inner as Record<string, unknown>).navigate;
		const data: Record<string, unknown> = {...(inner.data ?? {})};
		if (typeof navigateUrl === 'string' && !data.url) data.url = navigateUrl;
		return {...inner, data};
	}
	return payload;
};
/**
 * Message pushes are Wake-up Pushes: the server never sends message content,
 * sender names, avatars, attachment URLs or channel names. The worker shows a
 * generic notification and the app fetches and decrypts the message itself.
 */
export const WAKEUP_PUSH_TYPE = 'wakeup';
export const WAKEUP_PUSH_BODY = 'New message';
const CONTENT_KEYS = [
	'title',
	'body',
	'icon',
	'badge',
	'image',
	'image_url',
	'author_avatar_url',
	'channel_name',
	'parent_name',
	'caller_id',
	'caller_name',
	'caller_avatar_url',
	'has_media',
] as const;
export const isWakeupPushPayload = (payload: PushPayload): boolean =>
	payload.type === WAKEUP_PUSH_TYPE || payload.data?.type === WAKEUP_PUSH_TYPE;
const withoutContent = (record: Record<string, unknown>): Record<string, unknown> => {
	const copy = {...record};
	for (const key of CONTENT_KEYS) delete copy[key];
	return copy;
};
/**
 * Drops anything that could carry plaintext or sender metadata, so the worker
 * can never render server-supplied content even if a payload contains it.
 */
export const toWakeupPushPayload = (payload: PushPayload): PushPayload => {
	const {notification: _notification, ...rest} = payload;
	const sanitized = withoutContent(rest as Record<string, unknown>) as PushPayload;
	return {
		...sanitized,
		type: sanitized.type ?? WAKEUP_PUSH_TYPE,
		data: payload.data ? withoutContent(payload.data) : undefined,
	};
};
const PUSH_TITLE_MANIFEST_TIMEOUT_MS = 2000;
export interface InstanceManifestSources {
	fetchManifest: (signal: AbortSignal) => Promise<Response>;
	readCachedManifest: () => Promise<Response | undefined>;
}
const readManifestName = async (response: Response | undefined): Promise<string | null> => {
	if (!response?.ok) return null;
	const manifest: unknown = await response.json();
	const name = isRecord(manifest) && typeof manifest.name === 'string' ? manifest.name.trim() : '';
	return name.length > 0 ? name : null;
};
const fetchManifestName = async (sources: InstanceManifestSources, timeoutMs: number): Promise<string | null> => {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timedOut = new Promise<null>((resolve) => {
		timer = setTimeout(() => {
			controller.abort();
			resolve(null);
		}, timeoutMs);
	});
	try {
		return await Promise.race([sources.fetchManifest(controller.signal).then(readManifestName), timedOut]);
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
};
const readCachedManifestName = async (sources: InstanceManifestSources): Promise<string | null> => {
	try {
		return await readManifestName(await sources.readCachedManifest());
	} catch {
		return null;
	}
};
export const resolvePushTitle = async (sources: InstanceManifestSources): Promise<string> => {
	return (
		(await fetchManifestName(sources, PUSH_TITLE_MANIFEST_TIMEOUT_MS)) ??
		(await readCachedManifestName(sources)) ??
		PRODUCT_NAME
	);
};
export const getBadgeCount = (payload: PushPayload): number | null => {
	const badgeValue = payload.data?.badge_count;
	if (typeof badgeValue === 'number' && Number.isFinite(badgeValue)) {
		return badgeValue;
	}
	if (typeof badgeValue === 'string' && badgeValue.length > 0) {
		const parsed = Number(badgeValue);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};
export const resolvePushNotificationTag = (payload: PushPayload): string | undefined => {
	const explicitTag = payload.tag ?? payload.data?.tag ?? payload.data?.notification_tag;
	if (typeof explicitTag === 'string' && explicitTag.length > 0) {
		return explicitTag;
	}
	const channelId = payload.data?.channel_id;
	if (typeof channelId === 'string' && channelId.length > 0) {
		return `channel:${channelId}`;
	}
	return undefined;
};
export const resolvePushMessageId = (payload: PushPayload): string | undefined => {
	const messageId = payload.data?.message_id;
	if (typeof messageId === 'string' && messageId.length > 0) {
		return messageId;
	}
	return undefined;
};
export const shouldRenotifyPushNotification = (
	messageId: string | undefined,
	shownWithSameTag: ReadonlyArray<{readonly data?: unknown}>,
): boolean =>
	messageId === undefined ||
	!shownWithSameTag.some((notification) => isRecord(notification.data) && notification.data.message_id === messageId);
export const resolvePushChannelId = (payload: PushPayload): string | undefined => {
	const channelId = payload.data?.channel_id;
	if (typeof channelId === 'string' && channelId.length > 0) {
		return channelId;
	}
	return undefined;
};
export const matchesPushChannelNotification = (notification: Notification, channelId: string): boolean => {
	if (channelId.length === 0) {
		return false;
	}
	const data = isRecord(notification.data) ? notification.data : undefined;
	const dataChannelId = data?.channel_id;
	if (typeof dataChannelId === 'string' && dataChannelId === channelId) {
		return true;
	}
	const channelTag = `channel:${channelId}`;
	const tag = notification.tag;
	if (tag === channelTag) {
		return true;
	}
	return typeof tag === 'string' && tag.startsWith(`${channelTag}:`);
};
const SNOWFLAKE_PATTERN = /^[1-9]\d*$/;
export const isPushNotificationReadThrough = (
	notification: {readonly data?: unknown},
	readThroughMessageId: string | undefined,
): boolean => {
	if (readThroughMessageId === undefined || !SNOWFLAKE_PATTERN.test(readThroughMessageId)) {
		return true;
	}
	const messageId = isRecord(notification.data) ? notification.data.message_id : undefined;
	if (typeof messageId !== 'string' || !SNOWFLAKE_PATTERN.test(messageId)) {
		return true;
	}
	return BigInt(messageId) <= BigInt(readThroughMessageId);
};
export const getPushNotificationClientState = (
	clients: ReadonlyArray<{readonly visibilityState?: string}>,
): PushNotificationClientState => ({
	hasWindowClient: clients.length > 0,
	hasVisibleClient: clients.some((client) => client.visibilityState === 'visible'),
});
export const shouldSilenceNonMobilePushNotification = (clientState: PushNotificationClientState): boolean =>
	clientState.hasWindowClient;
export const isNotificationClearPayload = (payload: PushPayload): boolean => {
	const record = payload as Record<string, unknown>;
	const data = payload.data ?? {};
	return (
		record.type === 'notification_clear' ||
		record.action === 'clear_channel' ||
		data.type === 'notification_clear' ||
		data.action === 'clear_channel' ||
		payload.notification?.data?.type === 'notification_clear' ||
		payload.notification?.data?.action === 'clear_channel'
	);
};
