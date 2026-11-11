// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {describe, it} from 'vitest';

const globalsCss = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');
const colorSystemSource = readFileSync(new URL('../../scripts/GenerateColorSystem.ts', import.meta.url), 'utf8');
const colorPaletteSource = readFileSync(
	new URL('../features/theme/utils/ColorSystemPalette.ts', import.meta.url),
	'utf8',
);
const entrypoint = readFileSync(new URL('../index.tsx', import.meta.url), 'utf8');
const sharedPalette = readFileSync(new URL('../../../packages/brand/css/palette.css', import.meta.url), 'utf8');
const buttonStyles = readFileSync(new URL('../features/ui/button/Button.module.css', import.meta.url), 'utf8');
const inputStyles = readFileSync(
	new URL('../features/ui/components/form/FormInput.module.css', import.meta.url),
	'utf8',
);
const menuStyles = readFileSync(new URL('../features/ui/action_menu/ContextMenu.module.css', import.meta.url), 'utf8');
const shellStyles = readFileSync(
	new URL('../features/app/components/layout/GuildsLayout.module.css', import.meta.url),
	'utf8',
);
const imageDirectory = new URL('../media/images/', import.meta.url);

describe('OSACA visual foundation', () => {
	it('publishes the official palette and shared layout primitives', () => {
		assert.match(entrypoint, /@osaca\/brand\/css\/palette\.css/);
		assert.match(sharedPalette, /--osaca-color-navy: #102b42;/);
		assert.match(sharedPalette, /--osaca-color-earth-red: #e84b35;/);
		assert.match(sharedPalette, /--osaca-color-ivory: #f3f1eb;/);
		assert.match(sharedPalette, /--osaca-color-slate: #687783;/);
		assert.match(sharedPalette, /--osaca-color-white: #ffffff;/);
		assert.match(globalsCss, /--focus-ring:/);
		assert.match(globalsCss, /--breakpoint-tablet: 64rem;/);
		assert.match(globalsCss, /\.theme-light \{/);
		assert.match(globalsCss, /\.theme-dark,/);
		assert.match(globalsCss, /@media \(prefers-reduced-motion: reduce\)/);
	});

	it('defaults the OSACA surfaces to the dark theme like the generated colour system', () => {
		// Screens shown before a theme class is applied (boot failure, crash) read :root. The generated text
		// tokens there are the dark theme's, so the surfaces must be too (found in the #45 browser pass).
		const block = (selector: RegExp) => globalsCss.match(selector)?.[1] ?? '';
		const tokens = (css: string) =>
			Object.fromEntries([...css.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
		const root = tokens(block(/^:root \{([^}]*)\}/m));
		const dark = tokens(block(/^\.theme-dark,\n\.theme-coal,\n\.theme-dark_legacy \{([^}]*)\}/m));

		const surfaces = [
			'--guild-sidebar-bg',
			'--channel-sidebar-bg',
			'--chat-canvas-bg',
			'--chat-surface-bg',
			'--message-timestamp-color',
			'--composer-pill-bg',
		];
		for (const name of surfaces) {
			assert.ok(dark[name], `${name} has a dark value`);
			assert.equal(root[name], dark[name], `${name} at :root matches .theme-dark`);
		}
	});

	it('keeps white text on the default brand action at AA contrast', () => {
		// Found in the #45 browser pass: hsl(7, 80%, 55%) under white button text was 3.76:1.
		const brand = colorPaletteSource.match(/\bbrand: \{hue: (\d+), saturation: (\d+)/);
		const lightness = colorSystemSource.match(/\{name: '--brand-primary', family: 'brand', lightness: (\d+)/)?.[1];
		assert.ok(brand && lightness, 'brand family and --brand-primary lightness are declared');

		const [h, s, l] = [Number(brand[1]), Number(brand[2]) / 100, Number(lightness) / 100];
		const channel = (n: number) => {
			const k = (n + h / 30) % 12;
			return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		};
		const luminance = (rgb: Array<number>) =>
			rgb
				.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
				.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
		const background = luminance([channel(0), channel(8), channel(4)]);
		// --text-on-brand-primary is a grey (saturation 0), so its lightness is each RGB channel.
		const textLightness = colorSystemSource.match(
			/name: '--text-on-brand-primary',\s*hue: 0,\s*saturation: 0,\s*lightness: (\d+)/,
		)?.[1];
		assert.ok(textLightness, '--text-on-brand-primary is a declared grey');
		const grey = Number(textLightness) / 100;
		const text = luminance([grey, grey, grey]);
		const ratio = (text + 0.05) / (background + 0.05);
		assert.ok(ratio >= 4.5, `text on --brand-primary is ${ratio.toFixed(2)}:1`);
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

	it('applies shared OSACA states to shell primitives', () => {
		assert.match(buttonStyles, /var\(--osaca-action-primary/);
		assert.match(buttonStyles, /var\(--osaca-status-danger/);
		assert.match(inputStyles, /var\(--osaca-color-focus/);
		assert.match(inputStyles, /var\(--osaca-status-danger/);
		assert.match(menuStyles, /min-height: 2\.25rem/);
		assert.match(shellStyles, /var\(--osaca-surface-navigation/);
	});
});
