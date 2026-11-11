// SPDX-License-Identifier: AGPL-3.0-or-later

// The official OSACA palette lives in packages/brand/css/palette.css; every surface imports it (issue #44).
// Run with `node --test tools/branding/SharedPalette.test.mjs` from the repository root.

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

const repoRoot = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, repoRoot), 'utf8').replace(/\r\n/g, '\n');

const OFFICIAL = {
	navy: '#102b42',
	'earth-red': '#e84b35',
	ivory: '#f3f1eb',
	slate: '#687783',
	white: '#ffffff',
	black: '#0b1722',
	// Derived for accessibility: actions with white text and focus rings on light or dark surfaces.
	action: '#c73a27',
	'action-strong': '#a52e1d',
	'focus-on-light': '#1d5fbf',
	'focus-on-dark': '#7db6ff',
};

const SURFACE_STYLES = {
	app: 'osaca_app/src/app/globals.css',
	admin: 'osaca_admin/src/styles/app.css',
	docs: 'osaca_docs/src/styles/tokens.css',
	landing: 'osaca_landing/src/styles/landing.css',
};

const SURFACE_IMPORTS = {
	app: ['osaca_app/src/index.tsx', /import '@osaca\/brand\/css\/palette\.css';/],
	admin: ['osaca_admin/src/styles/app.css', /@import "\.\.\/\.\.\/\.\.\/packages\/brand\/css\/palette\.css";/],
	docs: ['osaca_docs/astro.config.ts', /'\.\.\/packages\/brand\/css\/palette\.css'/],
	landing: ['osaca_landing/src/pages/index.astro', /import '\.\.\/\.\.\/\.\.\/packages\/brand\/css\/palette\.css';/],
};

describe('shared OSACA palette', () => {
	it('defines the official palette once', () => {
		const palette = read('packages/brand/css/palette.css');
		for (const [name, hex] of Object.entries(OFFICIAL)) {
			assert.match(palette, new RegExp(`--osaca-color-${name}: ${hex};`), `--osaca-color-${name}`);
		}
	});

	for (const [surface, [file, pattern]] of Object.entries(SURFACE_IMPORTS)) {
		it(`is imported by the ${surface} surface`, () => {
			assert.match(read(file), pattern);
		});
	}

	for (const [surface, file] of Object.entries(SURFACE_STYLES)) {
		it(`is not redefined or hard-coded in the ${surface} styles`, () => {
			const css = read(file);
			assert.doesNotMatch(css, new RegExp(`--osaca-color-(${Object.keys(OFFICIAL).join('|')}):`));
			const hardCoded = new RegExp(`--[a-z-]+: (${Object.values(OFFICIAL).join('|')});`, 'gi');
			assert.deepEqual(css.match(hardCoded) ?? [], [], 'palette colours come from the shared palette');
		});
	}
});
