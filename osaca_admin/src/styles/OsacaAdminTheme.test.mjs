// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {describe, it} from 'node:test';

const adminRoot = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, adminRoot), 'utf8').replace(/\r\n/g, '\n');

function filesUnder(dir, pattern) {
	return readdirSync(dir).flatMap((name) => {
		const entry = new URL(name, dir);
		if (statSync(entry).isDirectory()) {
			return name === 'generated' ? [] : filesUnder(new URL(`${name}/`, dir), pattern);
		}
		return pattern.test(name) ? [entry] : [];
	});
}

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

describe('OSACA admin panel', () => {
	it('ships the approved OSACA logo and wordmark instead of inherited artwork', () => {
		const logo = read('static/osaca-logo-color.svg');
		const wordmark = read('static/osaca-wordmark.svg');
		const approvedLogo = readFileSync(new URL('../osaca_app/src/media/images/osaca-logo-color.svg', adminRoot), 'utf8');
		const approvedWordmark = readFileSync(new URL('../osaca_app/src/media/images/osaca-wordmark.svg', adminRoot), 'utf8');

		assert.equal(logo.replace(/\r\n/g, '\n'), approvedLogo.replace(/\r\n/g, '\n'));
		assert.equal(wordmark.replace(/\r\n/g, '\n'), approvedWordmark.replace(/\r\n/g, '\n'));
	});

	it('uses the OSACA palette, typography and focus colour instead of the inherited indigo', () => {
		const css = read('src/styles/app.css');
		const theme = css.match(/^@theme \{([^}]*)\}/m)?.[1] ?? '';
		const brand = theme.match(/--color-brand-primary: (#[0-9a-f]{6});/)?.[1];

		assert.doesNotMatch(css, /hsl\(242/);
		assert.match(theme, /--font-sans: "Inter", "OSACA Sans"/);
		assert.match(theme, /--font-display: "Montserrat", "OSACA Sans"/);
		assert.match(theme, /--color-osaca-navy: #102b42;/);
		assert.ok(brand, 'brand primary is a hex colour');
		assert.ok(contrast(brand, '#ffffff') >= 4.5, `white on ${brand} reaches AA`);
		assert.match(theme, /--color-red-600: hsl\(355 /);
		assert.match(css, /:focus-visible \{\n {2}outline: 2px solid var\(--osaca-focus\);/);
	});

	it('gives the dark theme OSACA navy surfaces and a lighter focus colour', () => {
		const css = read('src/styles/app.css');
		const light = css.match(/^:root \{([^}]*)\}/m)?.[1] ?? '';
		const dark = css.match(/^:root\[data-theme="dark"\] \{([^}]*)\}/m)?.[1] ?? '';

		assert.match(light, /--osaca-focus: #1d5fbf;/);
		assert.match(dark, /--osaca-focus: #7db6ff;/);
		assert.match(dark, /--color-white: #172635;/);
		assert.match(dark, /--color-neutral-50: #10202e;/);
		assert.doesNotMatch(dark, /--color-neutral-\d+: oklch\([\d.]+ 0 0\)/);
	});

	it('keeps the navigation sidebar on OSACA navy in both themes', () => {
		const css = read('src/styles/app.css');

		assert.match(css, /^#admin-sidebar \{\n {2}background-color: var\(--color-osaca-navy\);/m);
		assert.match(css, /^:root\[data-theme="dark"\] #admin-sidebar \{[^}]*background-color: #0b1722;/m);
	});

	it('draws focus rings and focused borders with the OSACA focus colour, not the brand action', () => {
		const css = read('src/styles/app.css');
		const templates = filesUnder(new URL('src/', adminRoot), /\.rs$/);
		const offenders = templates.filter((file) =>
			/focus(-visible)?:(ring|border|outline)-brand-primary/.test(readFileSync(file, 'utf8')),
		);

		assert.match(css, /--color-osaca-focus: var\(--osaca-focus\);/);
		assert.deepEqual(
			offenders.map((file) => file.pathname),
			[],
		);
	});

	it('carries no Fluxer branding in admin source, styles or static assets', () => {
		const files = [
			...filesUnder(new URL('src/', adminRoot), /\.(rs|css)$/),
			...filesUnder(new URL('static/', adminRoot), /\.(svg|js|css)$/),
		];
		const offenders = files.filter((file) => /fluxer/i.test(readFileSync(file, 'utf8')));

		assert.deepEqual(
			offenders.map((file) => file.pathname),
			[],
		);
	});
});
