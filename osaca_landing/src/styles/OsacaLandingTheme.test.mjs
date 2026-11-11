// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';
import {resolvePalette} from '../../../tools/branding/palette.mjs';

const css = resolvePalette(readFileSync(new URL('./landing.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));

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

function tokens(selector) {
	const escaped = selector.replace(/[[\]()]/g, '\\$&');
	const block = css.match(new RegExp(`^${escaped} \\{([^}]*)\\}`, 'm'))?.[1] ?? '';
	return Object.fromEntries([...block.matchAll(/--([a-z-]+): (#[0-9a-f]{6});/g)].map(([, name, hex]) => [name, hex]));
}

const light = tokens(':root');
const dark = {...light, ...tokens(":root[data-theme='dark']")};

describe('OSACA landing theme', () => {
	it('uses the official OSACA palette as its base', () => {
		assert.equal(light['osaca-navy'], '#102b42');
		assert.equal(light['osaca-earth-red'], '#e84b35');
		assert.equal(light['osaca-ivory'], '#f3f1eb');
		assert.equal(light['osaca-slate'], '#687783');
	});

	for (const [name, theme] of [
		['light', light],
		['dark', dark],
	]) {
		it(`keeps text, links and actions at AA contrast in the ${name} theme`, () => {
			const pairs = [
				['text', 'surface'],
				['text-muted', 'surface'],
				['text', 'surface-raised'],
				['text-muted', 'surface-raised'],
				['link', 'surface'],
				['link', 'surface-raised'],
				['action-text', 'action'],
				['warning-text', 'warning-surface'],
			];
			for (const [fg, bg] of pairs) {
				assert.ok(theme[fg] && theme[bg], `--${fg} and --${bg} are hex tokens`);
				const ratio = contrast(theme[fg], theme[bg]);
				assert.ok(ratio >= 4.5, `--${fg} ${theme[fg]} on --${bg} ${theme[bg]} is ${ratio.toFixed(2)}:1`);
			}
		});

		it(`shows a focus ring that stands out from the ${name} surfaces`, () => {
			for (const bg of ['surface', 'surface-raised']) {
				const ratio = contrast(theme.focus, theme[bg]);
				assert.ok(ratio >= 3, `--focus on --${bg} is ${ratio.toFixed(2)}:1`);
			}
		});
	}

	it('keeps the always-navy header readable and its focus ring visible in every theme', () => {
		const header = tokens('.site-header');
		for (const theme of [light, dark]) {
			const textRatio = contrast(light['hero-text'], theme['hero-surface']);
			assert.ok(textRatio >= 4.5, `header text on ${theme['hero-surface']} is ${textRatio.toFixed(2)}:1`);
			const focusRatio = contrast(header.focus, theme['hero-surface']);
			assert.ok(
				focusRatio >= 3,
				`header focus ${header.focus} on ${theme['hero-surface']} is ${focusRatio.toFixed(2)}:1`,
			);
		}
	});

	it('follows the system theme unless the visitor picks one, and respects reduced motion', () => {
		const system = css.match(
			/@media \(prefers-color-scheme: dark\) \{\n\t:root:not\(\[data-theme='light'\]\) \{([^}]*)\}/,
		)?.[1];
		assert.ok(system, 'dark tokens apply when the system prefers dark');
		const systemTokens = Object.fromEntries(
			[...system.matchAll(/--([a-z-]+): (#[0-9a-f]{6});/g)].map(([, name, hex]) => [name, hex]),
		);
		assert.deepEqual(systemTokens, tokens(":root[data-theme='dark']"));
		assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
		assert.match(css, /:focus-visible \{\n\toutline: 2px solid var\(--focus\);/);
	});
});
