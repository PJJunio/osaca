// SPDX-License-Identifier: AGPL-3.0-or-later

import {describe, expect, it} from 'vitest';
import {
	generateDeterministicIdenticon,
	hashIdentityString,
	OSACA_IDENTICON_PALETTES,
} from './DeterministicIdenticon';

describe('DeterministicIdenticon', () => {
	it('hashes identity strings deterministically', () => {
		const hash1 = hashIdentityString('user-12345');
		const hash2 = hashIdentityString('user-12345');
		const hash3 = hashIdentityString('user-67890');

		expect(hash1).toBe(hash2);
		expect(hash1).not.toBe(hash3);
		expect(hash1).toBeGreaterThanOrEqual(0);
	});

	it('generates consistent SVG data URIs for the same ID', () => {
		const uri1 = generateDeterministicIdenticon('anon-user-alpha');
		const uri2 = generateDeterministicIdenticon('anon-user-alpha');

		expect(uri1).toBe(uri2);
		expect(uri1.startsWith('data:image/svg+xml;utf8,')).toBe(true);
	});

	it('generates different identicons for different IDs', () => {
		const uriA = generateDeterministicIdenticon('user-a');
		const uriB = generateDeterministicIdenticon('user-b');

		expect(uriA).not.toBe(uriB);
	});

	it('constrains colors strictly to the OSACA palette', () => {
		const allowedColors = new Set([
			'#102B42', // Azul-marinho
			'#E84B35', // Vermelho-terra
			'#687783', // Cinza ardósia
			'#F3F1EB', // Marfim
			'#FFFFFF', // Branco
			'#1B3850', // Azul-marinho variante
		]);

		for (const palette of OSACA_IDENTICON_PALETTES) {
			expect(allowedColors.has(palette.bg)).toBe(true);
			expect(allowedColors.has(palette.fg)).toBe(true);
			expect(allowedColors.has(palette.accent)).toBe(true);
		}

		for (let i = 0; i < 20; i++) {
			const uri = generateDeterministicIdenticon(`test-account-${i}`);
			const decoded = decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));

			const fillMatches = decoded.match(/fill="([^"]+)"/g) || [];
			for (const match of fillMatches) {
				const color = match.replace('fill="', '').replace('"', '');
				expect(allowedColors.has(color.toUpperCase())).toBe(true);
			}
		}
	});

	it('renders initials with Montserrat font when initials are provided', () => {
		const uri = generateDeterministicIdenticon('alice-key', 'AL');
		const decoded = decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));

		expect(decoded).toContain('<text');
		expect(decoded).toContain('AL');
		expect(decoded).toContain('Montserrat');
	});
});
