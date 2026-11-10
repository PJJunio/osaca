// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

const globalsCss = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const colorSystemSource = readFileSync(new URL('../../scripts/GenerateColorSystem.ts', import.meta.url), 'utf8');
const colorPaletteSource = readFileSync(
	new URL('../features/theme/utils/ColorSystemPalette.ts', import.meta.url),
	'utf8',
);
const entrypoint = readFileSync(new URL('../index.tsx', import.meta.url), 'utf8');
const imageDirectory = new URL('../media/images/', import.meta.url);

describe('OSACA visual foundation', () => {
	it('publishes the official palette and shared layout primitives', () => {
		assert.match(globalsCss, /--osaca-color-navy: #102b42;/);
		assert.match(globalsCss, /--osaca-color-earth-red: #e84b35;/);
		assert.match(globalsCss, /--osaca-color-ivory: #f3f1eb;/);
		assert.match(globalsCss, /--osaca-color-slate: #687783;/);
		assert.match(globalsCss, /--osaca-color-white: #ffffff;/);
		assert.match(globalsCss, /--focus-ring:/);
		assert.match(globalsCss, /--breakpoint-tablet: 64rem;/);
		assert.match(globalsCss, /\.theme-light \{/);
		assert.match(globalsCss, /\.theme-dark,/);
		assert.match(globalsCss, /@media \(prefers-reduced-motion: reduce\)/);
	});

	it('keeps danger feedback separate from the earth-red brand action', () => {
		assert.match(colorPaletteSource, /statusDanger:/);
		assert.match(colorPaletteSource, /hue: 355/);
		assert.match(colorPaletteSource, /saturation: 70/);
		assert.match(colorSystemSource, /\{name: '--accent-danger', value: 'var\(--status-danger\)'\}/);
	});

	it('loads the approved Montserrat and Inter font families through the app entrypoint', () => {
		assert.match(entrypoint, /@osaca\/fonts\/css\/montserrat\.css/);
		assert.match(entrypoint, /@osaca\/fonts\/css\/inter\.css/);
	});

	it('ships the approved OSACA logo variants', () => {
		assert.equal(existsSync(new URL('osaca-logo-color.svg', imageDirectory)), true);
		assert.equal(existsSync(new URL('osaca-logo-wordmark-monochrome.svg', imageDirectory)), true);
		assert.equal(existsSync(new URL('osaca-wordmark.svg', imageDirectory)), true);
	});
});
