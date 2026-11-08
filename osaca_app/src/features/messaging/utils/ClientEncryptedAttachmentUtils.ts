// SPDX-License-Identifier: AGPL-3.0-or-later

import {decryptAttachmentBytes, encryptAttachmentBytes, uint8ArrayToBase64} from '@osaca/crypto';
import type {MessageAttachment} from '@osaca/schema/src/domains/message/MessageResponseSchemas';
import type {MlsEncryptedAttachment, MlsEncryptedThumbnail} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';
import {useEffect, useState} from 'react';
import {rgbaToThumbHash} from 'thumbhash';

const MAX_THUMBNAIL_DIMENSION = 128;
const decryptedObjectUrlCache = new Map<string, string>();

export interface EncryptedAttachmentPrepared {
	encryptedFile: File;
	metadata: MlsEncryptedAttachment;
}

export async function readFileAsUint8Array(file: File | Blob): Promise<Uint8Array> {
	if (typeof file.arrayBuffer === 'function') {
		const buf = await file.arrayBuffer();
		return new Uint8Array(buf);
	}
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (reader.result instanceof ArrayBuffer) {
				resolve(new Uint8Array(reader.result));
			} else {
				reject(new Error('Expected ArrayBuffer from FileReader'));
			}
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(file);
	});
}

export async function generateClientImageThumbnailAndThumbHash(file: File): Promise<{
	width?: number;
	height?: number;
	thumbhash?: string;
	thumbnailBytes?: Uint8Array;
}> {
	if (!file.type.startsWith('image/') || typeof document === 'undefined') {
		return {};
	}

	return new Promise((resolve) => {
		const objectUrl = URL.createObjectURL(file);
		const img = new Image();

		img.onload = () => {
			try {
				const width = img.naturalWidth;
				const height = img.naturalHeight;

				if (width <= 0 || height <= 0) {
					URL.revokeObjectURL(objectUrl);
					resolve({width, height});
					return;
				}

				const scale = Math.min(1, MAX_THUMBNAIL_DIMENSION / Math.max(width, height));
				const thumbWidth = Math.max(1, Math.round(width * scale));
				const thumbHeight = Math.max(1, Math.round(height * scale));

				const canvas = document.createElement('canvas');
				canvas.width = thumbWidth;
				canvas.height = thumbHeight;
				const ctx = canvas.getContext('2d');

				if (!ctx) {
					URL.revokeObjectURL(objectUrl);
					resolve({width, height});
					return;
				}

				ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
				const imageData = ctx.getImageData(0, 0, thumbWidth, thumbHeight);

				let thumbhash: string | undefined;
				try {
					const hashBytes = rgbaToThumbHash(thumbWidth, thumbHeight, imageData.data);
					thumbhash = uint8ArrayToBase64(hashBytes);
				} catch {}

				canvas.toBlob(
					async (blob) => {
						URL.revokeObjectURL(objectUrl);
						let thumbnailBytes: Uint8Array | undefined;
						if (blob) {
							thumbnailBytes = await readFileAsUint8Array(blob);
						}
						resolve({
							width,
							height,
							thumbhash,
							thumbnailBytes,
						});
					},
					'image/jpeg',
					0.8,
				);
			} catch {
				URL.revokeObjectURL(objectUrl);
				resolve({});
			}
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			resolve({});
		};

		img.src = objectUrl;
	});
}

export async function encryptClientAttachment(
	file: File,
	options?: {
		id?: string;
		generateThumbnail?: boolean;
	},
): Promise<EncryptedAttachmentPrepared> {
	const plaintextBytes = await readFileAsUint8Array(file);
	const encrypted = await encryptAttachmentBytes(plaintextBytes);

	let width: number | undefined;
	let height: number | undefined;
	let thumbhash: string | undefined;
	let encryptedThumbnail: MlsEncryptedThumbnail | undefined;

	if (options?.generateThumbnail !== false && file.type.startsWith('image/')) {
		const thumbResult = await generateClientImageThumbnailAndThumbHash(file);
		width = thumbResult.width;
		height = thumbResult.height;
		thumbhash = thumbResult.thumbhash;

		if (thumbResult.thumbnailBytes && width && height) {
			const encThumb = await encryptAttachmentBytes(thumbResult.thumbnailBytes);
			encryptedThumbnail = {
				ciphertext: uint8ArrayToBase64(encThumb.ciphertext),
				nonce: encThumb.nonce,
				width,
				height,
				content_type: 'image/jpeg',
			};
		}
	}

	const opaqueName = `enc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.bin`;
	const encryptedBlob = new Blob([encrypted.ciphertext as unknown as BlobPart], {type: 'application/octet-stream'});
	const encryptedFile = new File([encryptedBlob], opaqueName, {type: 'application/octet-stream'});

	const metadata: MlsEncryptedAttachment = {
		id: options?.id ?? String(Date.now()),
		filename: file.name,
		content_type: file.type || 'application/octet-stream',
		size: file.size,
		ciphertext_size: encrypted.ciphertext_size,
		sha256: encrypted.sha256,
		key: encrypted.key,
		nonce: encrypted.nonce,
		width,
		height,
		thumbhash,
		encrypted_thumbnail: encryptedThumbnail,
	};

	return {
		encryptedFile,
		metadata,
	};
}

export function getCachedDecryptedAttachmentUrl(idOrSha: string): string | undefined {
	return decryptedObjectUrlCache.get(idOrSha);
}

export async function decryptClientAttachmentBlob(
	ciphertextInput: Blob | ArrayBuffer | Uint8Array,
	metadata: MlsEncryptedAttachment,
): Promise<{blob: Blob; objectUrl: string}> {
	const cacheKey = metadata.sha256 || metadata.id;
	const existing = decryptedObjectUrlCache.get(cacheKey);
	if (existing) {
		const res = await fetch(existing);
		const blob = await res.blob();
		return {blob, objectUrl: existing};
	}

	let bytes: Uint8Array;
	if (ciphertextInput instanceof Uint8Array) {
		bytes = ciphertextInput;
	} else if (ciphertextInput instanceof ArrayBuffer) {
		bytes = new Uint8Array(ciphertextInput);
	} else {
		bytes = await readFileAsUint8Array(ciphertextInput);
	}

	const decryptedBytes = await decryptAttachmentBytes(bytes, metadata.key, metadata.nonce, metadata.sha256);

	const decryptedBlob = new Blob([decryptedBytes as unknown as BlobPart], {
		type: metadata.content_type || 'application/octet-stream',
	});
	const objectUrl = URL.createObjectURL(decryptedBlob);

	decryptedObjectUrlCache.set(cacheKey, objectUrl);
	if (metadata.id) {
		decryptedObjectUrlCache.set(metadata.id, objectUrl);
	}

	return {
		blob: decryptedBlob,
		objectUrl,
	};
}

export async function fetchAndDecryptAttachment(
	url: string,
	metadata: MlsEncryptedAttachment,
	options?: {signal?: AbortSignal},
): Promise<{blob: Blob; objectUrl: string}> {
	const cacheKey = metadata.sha256 || metadata.id;
	const existing = decryptedObjectUrlCache.get(cacheKey);
	if (existing) {
		const res = await fetch(existing);
		const blob = await res.blob();
		return {blob, objectUrl: existing};
	}

	const response = await fetch(url, {
		method: 'GET',
		signal: options?.signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch attachment ciphertext from ${url}: status ${response.status}`);
	}

	const ciphertextBuffer = await response.arrayBuffer();
	return decryptClientAttachmentBlob(ciphertextBuffer, metadata);
}

export function useDecryptedAttachmentUrl(attachment: MessageAttachment): string {
	const metadata = (attachment as {_mls_encrypted_attachment?: MlsEncryptedAttachment})._mls_encrypted_attachment;
	const fallbackUrl = attachment.proxy_url ?? attachment.url ?? '';
	const [url, setUrl] = useState<string>(() => {
		if (!metadata) return fallbackUrl;
		return getCachedDecryptedAttachmentUrl(metadata.sha256 || metadata.id) ?? '';
	});

	useEffect(() => {
		if (!metadata) {
			setUrl(fallbackUrl);
			return;
		}
		const cached = getCachedDecryptedAttachmentUrl(metadata.sha256 || metadata.id);
		if (cached) {
			setUrl(cached);
			return;
		}
		const sourceUrl = attachment.proxy_url ?? attachment.url;
		if (!sourceUrl) return;

		let cancelled = false;
		fetchAndDecryptAttachment(sourceUrl, metadata)
			.then(({objectUrl}) => {
				if (!cancelled) setUrl(objectUrl);
			})
			.catch((err) => {
				console.error('Failed to decrypt attachment', err);
			});

		return () => {
			cancelled = true;
		};
	}, [attachment, metadata, fallbackUrl]);

	return url;
}
