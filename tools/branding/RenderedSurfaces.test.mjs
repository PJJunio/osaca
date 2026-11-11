// SPDX-License-Identifier: AGPL-3.0-or-later

// Acceptance guard over the built public surfaces (issue #45): the landing page and every documentation page.
// Build first (`pnpm --filter osaca_landing build`, `pnpm --filter osaca_docs build`), then run
// `node --test tools/branding/RenderedSurfaces.test.mjs` from the repository root.
// Browser-only checks (contrast per theme, target sizes, focus rings) are recorded in docs/redesign-validation.md.

import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

const repoRoot = new URL('../../', import.meta.url);

const SURFACES = {
	landing: 'osaca_landing/dist/',
	docs: 'osaca_docs/dist/client/',
};

function filesIn(dir, extension) {
	const root = new URL(dir, repoRoot);
	if (!existsSync(root)) return [];
	return readdirSync(root, {recursive: true})
		.map((path) => String(path).replace(/\\/g, '/'))
		.filter((path) => path.endsWith(extension))
		.map((path) => ({path: `${dir}${path}`, text: readFileSync(new URL(path, root), 'utf8')}));
}

const visibleText = (html) =>
	html
		.replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');

/** The accessible name of an element given its opening tag and inner HTML, or '' when it has none. */
function accessibleName(openingTag, inner) {
	const label = openingTag.match(/\baria-label(?:ledby)?="([^"]*)"/)?.[1] ?? openingTag.match(/\btitle="([^"]*)"/)?.[1];
	if (label?.trim()) return label.trim();
	const alts = [...inner.matchAll(/<img\b[^>]*\balt="([^"]+)"/g)].map(([, alt]) => alt);
	const text = inner
		.replace(/<svg\b[\s\S]*?<\/svg>/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.trim();
	return [text, ...alts].join(' ').trim();
}

for (const [surface, dir] of Object.entries(SURFACES)) {
	const pages = filesIn(dir, '.html');
	const styles = filesIn(dir, '.css');

	describe(`${surface} (built)`, () => {
		it('has built pages to check', () => {
			assert.ok(pages.length > 0, `build ${dir} before this suite`);
		});

		it('declares a language, a viewport and a title on every page', () => {
			const missing = pages
				.filter(
					({text}) =>
						!/<html\b[^>]*\blang="[a-z]{2}/i.test(text) ||
						!/<meta\b[^>]*name="viewport"/.test(text) ||
						!/<title>[^<]+<\/title>/.test(text),
				)
				.map(({path}) => path);
			assert.deepEqual(missing, []);
		});

		it('shows no Fluxer name to visitors', () => {
			const offenders = pages.filter(({text}) => /fluxer/i.test(visibleText(text))).map(({path}) => path);
			assert.deepEqual(offenders, []);
		});

		it('gives every link, button and image a name', () => {
			const offenders = [];
			for (const {path, text} of pages) {
				const body = text.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/g, '');
				for (const [, tag, opening, inner] of body.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
					if (/\bhref=/.test(opening) || tag === 'button') {
						if (!accessibleName(opening, inner)) offenders.push(`${path}: <${tag}${opening}>`);
					}
				}
				for (const [img] of body.matchAll(/<img\b[^>]*>/g)) {
					// A bare `alt` is the minified empty alt of a decorative image.
					if (!/\balt(="|[\s>])/.test(img)) offenders.push(`${path}: ${img}`);
				}
			}
			assert.deepEqual(offenders, []);
		});

		it('keeps a space between words and inline links', () => {
			// A line break before an inline element in a template can be collapsed away at build time.
			const offenders = pages.flatMap(({path, text}) =>
				[...text.matchAll(/[a-z,;:]<a\b[^>]*>|<\/a>[a-z]/gi)].map(([match]) => `${path}: ${match.slice(0, 40)}`),
			);
			assert.deepEqual(offenders, []);
		});

		it('ships a visible focus style and honours reduced motion', () => {
			const css = styles.map(({text}) => text).join('\n') + pages.map(({text}) => text).join('\n');
			assert.match(css, /:focus-visible/, 'a :focus-visible style');
			assert.match(css, /prefers-reduced-motion:\s*reduce/, 'a prefers-reduced-motion: reduce rule');
		});
	});
}
