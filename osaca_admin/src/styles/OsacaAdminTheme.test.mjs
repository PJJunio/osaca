// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {describe, it} from 'node:test';
import {resolvePalette} from '../../../tools/branding/palette.mjs';

const adminRoot = new URL('../../', import.meta.url);
const read = (path) => resolvePalette(readFileSync(new URL(path, adminRoot), 'utf8').replace(/\r\n/g, '\n'));

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
		const approvedWordmark = readFileSync(
			new URL('../osaca_app/src/media/images/osaca-wordmark.svg', adminRoot),
			'utf8',
		);

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

	it('keeps secondary text at AA contrast on light page and card surfaces', () => {
		// Found in the #45 browser pass: Tailwind's neutral-500 reached 4.35:1 on the ivory page background.
		const theme = read('src/styles/app.css').match(/^@theme \{([^}]*)\}/m)?.[1] ?? '';
		const muted = theme.match(/--color-neutral-500: (#[0-9a-f]{6});/)?.[1];
		const page = theme.match(/--color-neutral-50: (#[0-9a-f]{6});/)?.[1];

		assert.ok(muted && page, '--color-neutral-500 and --color-neutral-50 are hex colours');
		for (const surface of [page, '#ffffff']) {
			const ratio = contrast(muted, surface);
			assert.ok(ratio >= 4.5, `neutral-500 ${muted} on ${surface} is ${ratio.toFixed(2)}:1`);
		}
	});

	it('takes closed drawers out of the keyboard order and accessibility tree', () => {
		// The panels carry Tailwind's `flex`, which overrides the browser's display:none for a closed popover.
		const css = read('src/styles/app.css');
		const closed = css.match(/^\.drawer-panel:not\(:popover-open\):not\(\[data-open\]\) \{([^}]*)\}/m)?.[1] ?? '';
		assert.match(closed, /visibility: hidden;/);
	});

	it('takes the closed mobile sidebar out of the keyboard order', () => {
		// Below lg the sidebar slides off-screen with -translate-x-full but its links stayed focusable.
		const css = read('src/styles/app.css');
		const mobile =
			css.match(/@media \(width < 64rem\) \{\n {2}#admin-sidebar\.-translate-x-full \{([^}]*)\}/)?.[1] ?? '';
		assert.match(mobile, /visibility: hidden;/);
	});

	it('marks required fields with an AA-contrast indicator', () => {
		const offenders = filesUnder(new URL('src/templates/', adminRoot), /\.rs$/)
			.filter((file) => /text-red-500[^"]*" \{ "\*" \}/.test(readFileSync(file, 'utf8')))
			.map((file) => file.pathname.split('/src/').pop());
		assert.deepEqual(offenders, [], 'red-500 is 3.81:1 on white');
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
		assert.notEqual(
			dark.match(/--color-white: (#[0-9a-f]{6});/)?.[1],
			dark.match(/--color-neutral-100: (#[0-9a-f]{6});/)?.[1],
			'hover:bg-neutral-100 must stay visible on white surfaces',
		);
	});

	it('keeps the navigation sidebar on OSACA navy in both themes', () => {
		const css = read('src/styles/app.css');
		const sidebar = css.match(/^#admin-sidebar \{([^}]*)\}/m)?.[1] ?? '';
		const greys = [...sidebar.matchAll(/--color-neutral-(200|300|400|500): (#[0-9a-f]{6});/g)];

		assert.equal(greys.length, 4);
		for (const [, shade, hex] of greys) {
			assert.ok(contrast(hex, '#102b42') >= 4.5, `sidebar neutral-${shade} ${hex} reaches AA on navy`);
		}
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

	it('asks for confirmation through the shared data-confirm primitive only', () => {
		const templates = filesUnder(new URL('src/', adminRoot), /\.rs$/);
		const offenders = templates.filter((file) =>
			/hx-confirm|onsubmit="return confirm\(/.test(readFileSync(file, 'utf8')),
		);

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
		const offenders = files.filter((file) =>
			/fluxer/i.test(readFileSync(file, 'utf8').replace(/^.*SPDX-FileCopyrightText:.*$/gm, '')),
		);

		assert.deepEqual(
			offenders.map((file) => file.pathname),
			[],
		);
	});
});
