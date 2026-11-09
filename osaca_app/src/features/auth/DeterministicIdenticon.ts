// SPDX-License-Identifier: AGPL-3.0-or-later

export interface IdenticonPalette {
	readonly bg: string;
	readonly fg: string;
	readonly accent: string;
}

export const OSACA_IDENTICON_PALETTES: ReadonlyArray<IdenticonPalette> = [
	{
		bg: '#102B42', // Azul-marinho
		fg: '#F3F1EB', // Marfim
		accent: '#E84B35', // Vermelho-terra
	},
	{
		bg: '#E84B35', // Vermelho-terra
		fg: '#F3F1EB', // Marfim
		accent: '#102B42', // Azul-marinho
	},
	{
		bg: '#687783', // Cinza ardósia
		fg: '#FFFFFF', // Branco
		accent: '#E84B35', // Vermelho-terra
	},
	{
		bg: '#F3F1EB', // Marfim
		fg: '#102B42', // Azul-marinho
		accent: '#E84B35', // Vermelho-terra
	},
	{
		bg: '#102B42', // Azul-marinho
		fg: '#E84B35', // Vermelho-terra
		accent: '#FFFFFF', // Branco
	},
	{
		bg: '#1B3850', // Azul-marinho variante
		fg: '#F3F1EB', // Marfim
		accent: '#E84B35', // Vermelho-terra
	},
];

/**
 * Deterministic 32-bit FNV-1a hash of any identity string (user ID, account key, public key).
 */
export function hashIdentityString(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

const IDENTICON_CACHE = new Map<string, string>();
const IDENTICON_CACHE_LIMIT = 512;

/**
 * Generates a deterministic, 100% client-side SVG identicon based on the hash of an ID
 * strictly adhering to the OSACA visual identity palette (ADR-0002).
 */
export function generateDeterministicIdenticon(id: string, initials?: string): string {
	const safeId = (id || 'osaca').trim();
	const cacheKey = `${safeId}:${initials || ''}`;
	const cached = IDENTICON_CACHE.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	const hash = hashIdentityString(safeId);
	const themeIndex = hash % OSACA_IDENTICON_PALETTES.length;
	const theme = OSACA_IDENTICON_PALETTES[themeIndex];

	let innerSvg: string;

	if (initials && initials.trim().length > 0) {
		const cleanInitials = initials.trim().slice(0, 2).toUpperCase();
		innerSvg = `<text x="32" y="40" text-anchor="middle" fill="${theme.fg}" font-family="'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700" font-size="24">${cleanInitials}</text>`;
	} else {
		// 5x5 symmetric geometric matrix identicon
		const cellSize = 7;
		const gap = 1.5;
		const padding = 11.5; // (64 - (5 * 7 + 4 * 1.5)) / 2 = (64 - 41) / 2 = 11.5
		const rects: string[] = [];

		for (let row = 0; row < 5; row++) {
			for (let col = 0; col < 3; col++) {
				const bitIndex = row * 3 + col;
				const isFilled = ((hash >> bitIndex) & 1) === 1 || (row === 2 && col === 2);

				if (isFilled) {
					const isCenter = row === 2 && col === 2;
					const fillColor = isCenter ? theme.accent : theme.fg;

					const x1 = (padding + col * (cellSize + gap)).toFixed(1);
					const y = (padding + row * (cellSize + gap)).toFixed(1);
					rects.push(`<rect x="${x1}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${fillColor}"/>`);

					// Mirror column across central axis
					if (col < 2) {
						const mirrorCol = 4 - col;
						const x2 = (padding + mirrorCol * (cellSize + gap)).toFixed(1);
						rects.push(`<rect x="${x2}" y="${y}" width="${cellSize}" height="${cellSize}" rx="1.5" fill="${fillColor}"/>`);
					}
				}
			}
		}

		innerSvg = rects.join('');
	}

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" fill="${theme.bg}"/>${innerSvg}</svg>`;
	const result = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

	if (IDENTICON_CACHE.size >= IDENTICON_CACHE_LIMIT) {
		IDENTICON_CACHE.clear();
	}
	IDENTICON_CACHE.set(cacheKey, result);

	return result;
}
