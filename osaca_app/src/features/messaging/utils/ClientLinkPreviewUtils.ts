// SPDX-License-Identifier: AGPL-3.0-or-later

import type {MlsLinkPreview} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';

const URL_REGEX = /https?:\/\/[^\s<>"'`]+/giu;
const TRAILING_PUNCTUATION_REGEX = /[.,:;!?)]+$/u;
const DEFAULT_PREVIEW_FETCH_TIMEOUT_MS = 5000;
const MAX_PREVIEWS_PER_MESSAGE = 3;

type DesktopUrlWrapper = (url: string) => string;
let registeredDesktopUrlWrapper: DesktopUrlWrapper | null = null;

export function registerDesktopUrlWrapper(wrapper: DesktopUrlWrapper | null): void {
	registeredDesktopUrlWrapper = wrapper;
}

type SenderLinkPreviewsSettingGetter = () => boolean;
let registeredSettingGetter: SenderLinkPreviewsSettingGetter | null = null;

export function registerSenderLinkPreviewsSettingGetter(getter: SenderLinkPreviewsSettingGetter | null): void {
	registeredSettingGetter = getter;
}

export function isSenderLinkPreviewsEnabled(): boolean {
	return registeredSettingGetter ? registeredSettingGetter() : false;
}

export function extractUrls(content: string): Array<string> {
	if (!content) return [];
	const matches = content.match(URL_REGEX);
	if (!matches) return [];

	const cleanUrls = matches
		.map((raw) => raw.replace(TRAILING_PUNCTUATION_REGEX, ''))
		.filter((url) => {
			try {
				const parsed = new URL(url);
				return parsed.protocol === 'http:' || parsed.protocol === 'https:';
			} catch {
				return false;
			}
		});

	return Array.from(new Set(cleanUrls));
}

export function parseHtmlMetadata(html: string, originalUrl: string): MlsLinkPreview {
	const result: MlsLinkPreview = {
		url: originalUrl,
	};

	// 1. Title: <meta property="og:title" content="..."> or <title>...</title>
	const ogTitleMatch =
		/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
		/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i.exec(html) ??
		/<meta\s+[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i.exec(html);

	if (ogTitleMatch?.[1]) {
		result.title = decodeHtmlEntities(ogTitleMatch[1].trim());
	} else {
		const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
		if (titleMatch?.[1]) {
			result.title = decodeHtmlEntities(titleMatch[1].trim());
		}
	}

	// 2. Description: <meta property="og:description" ...> or <meta name="description" ...>
	const ogDescMatch =
		/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
		/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i.exec(html) ??
		/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
		/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html) ??
		/<meta\s+[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i.exec(html);

	if (ogDescMatch?.[1]) {
		result.description = decodeHtmlEntities(ogDescMatch[1].trim());
	}

	// 3. Site Name: <meta property="og:site_name" ...>
	const ogSiteMatch =
		/<meta\s+[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
		/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:site_name["']/i.exec(html);

	if (ogSiteMatch?.[1]) {
		result.site_name = decodeHtmlEntities(ogSiteMatch[1].trim());
	}

	// 4. Image: <meta property="og:image" ...> or <meta name="twitter:image" ...>
	const ogImageMatch =
		/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
		/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i.exec(html) ??
		/<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i.exec(html);

	if (ogImageMatch?.[1]) {
		const rawImageUrl = ogImageMatch[1].trim();
		try {
			const resolvedImageUrl = new URL(rawImageUrl, originalUrl).toString();
			result.image = {
				url: resolvedImageUrl,
			};
		} catch {}
	}

	return result;
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#x2F;/g, '/');
}

export async function fetchSenderLinkPreview(
	url: string,
	options?: {
		signal?: AbortSignal;
		proxyUrl?: string;
		timeoutMs?: number;
		enabled?: boolean;
	},
): Promise<MlsLinkPreview | null> {
	const isEnabled = options?.enabled ?? isSenderLinkPreviewsEnabled();
	if (!isEnabled) {
		return null;
	}

	try {
		let requestUrl = url;
		if (options?.proxyUrl) {
			requestUrl = options.proxyUrl;
		} else if (registeredDesktopUrlWrapper) {
			requestUrl = registeredDesktopUrlWrapper(url);
		}

		const timeoutMs = options?.timeoutMs ?? DEFAULT_PREVIEW_FETCH_TIMEOUT_MS;
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const combinedSignal = options?.signal ? anySignal([options.signal, controller.signal]) : controller.signal;

		try {
			const response = await fetch(requestUrl, {
				method: 'GET',
				signal: combinedSignal,
				headers: {
					Accept: 'text/html,application/xhtml+xml',
				},
			});

			if (!response.ok) {
				return null;
			}

			const contentType = response.headers.get('content-type') ?? '';
			if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
				return null;
			}

			const html = await response.text();
			return parseHtmlMetadata(html, url);
		} finally {
			clearTimeout(timeoutId);
		}
	} catch {
		return null;
	}
}

function anySignal(signals: Array<AbortSignal>): AbortSignal {
	const controller = new AbortController();
	for (const sig of signals) {
		if (sig.aborted) {
			controller.abort();
			return controller.signal;
		}
		sig.addEventListener('abort', () => controller.abort(), {once: true});
	}
	return controller.signal;
}

export async function generateSenderLinkPreviews(
	content: string,
	options?: {
		signal?: AbortSignal;
		enabled?: boolean;
	},
): Promise<Array<MlsLinkPreview>> {
	const isEnabled = options?.enabled ?? isSenderLinkPreviewsEnabled();
	if (!isEnabled) {
		return [];
	}

	const urls = extractUrls(content).slice(0, MAX_PREVIEWS_PER_MESSAGE);
	if (urls.length === 0) return [];

	const previewPromises = urls.map((url) => fetchSenderLinkPreview(url, options));
	const results = await Promise.all(previewPromises);

	return results.filter((p): p is MlsLinkPreview => p !== null);
}
