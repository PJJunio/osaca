// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

const docsRoot = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, docsRoot), 'utf8').replace(/\r\n/g, '\n');

function luminance(hex) {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

function themeTokens(block) {
	return Object.fromEntries(
		[...block.matchAll(/--(flx-[a-z-]+): (#[0-9a-f]{6});/g)].map(([, name, hex]) => [name, hex]),
	);
}

// Resolves var(--osaca-color-*) from the shared palette so contrast checks see real colours.
const PALETTE = Object.fromEntries(
	[
		...readFileSync(new URL('../packages/brand/css/palette.css', docsRoot), 'utf8').matchAll(
			/--(osaca-color-[a-z-]+): (#[0-9a-f]{6});/g,
		),
	].map(([, name, hex]) => [name, hex]),
);
const resolvePalette = (text) =>
	text.replace(/var\(--(osaca-color-[a-z-]+)\)/g, (match, name) => PALETTE[name] ?? match);

const tokensCss = resolvePalette(read('src/styles/tokens.css'));
const dark = themeTokens(tokensCss.match(/^:root \{([^}]*--flx-background-primary[^}]*)\}/m)?.[1] ?? '');
const light = {...dark, ...themeTokens(tokensCss.match(/^:root\[data-theme='light'\] \{([^}]*)\}/m)?.[1] ?? '')};

describe('OSACA documentation theme', () => {
	it('self-hosts Inter and Montserrat instead of the inherited Radio Canada Big', () => {
		const fonts = read('src/fonts/Fonts.ts');
		const faces = read('src/fonts/LatinFontFaces.astro');
		const stack = read('src/fonts/font-stack.css');
		const config = read('astro.config.ts');

		for (const source of [fonts, faces, stack, config]) {
			assert.doesNotMatch(source, /radio.?canada/i);
		}
		assert.match(fonts, /name: 'Inter'/);
		assert.match(fonts, /name: 'Montserrat'/);
		assert.match(faces, /<Font cssVariable="--font-inter" preload \/>/);
		assert.match(faces, /<Font cssVariable="--font-montserrat" preload \/>/);
		assert.match(stack, /--osaca-font-stack:\s*var\(--font-inter\),/);
		assert.match(stack, /--osaca-heading-stack:\s*var\(--font-montserrat\),/);
	});

	it('draws a visible focus ring on every focusable element', () => {
		const layout = read('src/styles/layout.css');

		assert.match(layout, /:focus-visible \{\n\toutline: 2px solid var\(--flx-focus\);\n\toutline-offset: 2px;/);
	});

	for (const [name, theme] of [
		['dark', dark],
		['light', light],
	]) {
		it(`keeps links and secondary text at AA contrast in the ${name} theme`, () => {
			for (const surface of ['flx-background-primary', 'flx-background-secondary']) {
				for (const text of ['flx-link', 'flx-text-tertiary', 'flx-text-secondary', 'flx-accent-danger']) {
					assert.ok(theme[text] && theme[surface], `${text} and ${surface} are hex tokens`);
					const ratio = contrast(theme[text], theme[surface]);
					assert.ok(ratio >= 4.5, `${text} ${theme[text]} on ${surface} ${theme[surface]} is ${ratio.toFixed(2)}:1`);
				}
			}
		});

		it(`keeps the current-page highlight readable and focus visible in the ${name} theme`, () => {
			const brandRatio = contrast(theme['flx-on-brand'], theme['flx-brand']);
			assert.ok(brandRatio >= 4.5, `on-brand text on brand is ${brandRatio.toFixed(2)}:1`);
			for (const surface of ['flx-background-primary', 'flx-background-secondary']) {
				const focusRatio = contrast(theme['flx-focus'], theme[surface]);
				assert.ok(focusRatio >= 3, `focus ring on ${surface} is ${focusRatio.toFixed(2)}:1`);
			}
		});

		it(`keeps danger feedback distinct from the earth-red brand in the ${name} theme`, () => {
			assert.notEqual(theme['flx-accent-danger'], '#e84b35');
			assert.notEqual(theme['flx-accent-danger'], theme['flx-link']);
		});
	}
});
