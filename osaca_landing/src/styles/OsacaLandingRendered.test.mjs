// SPDX-License-Identifier: AGPL-3.0-or-later

// Checks the built page. `pnpm test:rendered` builds first; the suite reads dist/index.html.

import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

const builtPage = new URL('../../dist/index.html', import.meta.url);
const html = existsSync(builtPage) ? readFileSync(builtPage, 'utf8') : '';
const text = html
	.replace(/<script[\s\S]*?<\/script>/g, ' ')
	.replace(/<style[\s\S]*?<\/style>/g, ' ')
	.replace(/<svg[\s\S]*?<\/svg>/g, ' ')
	.replace(/<[^>]+>/g, ' ')
	.replace(/&nbsp;/g, ' ')
	.replace(/&#39;|&apos;/g, "'")
	.replace(/\s+/g, ' ');

/** Opening tags named `name` whose attributes match every pattern, in any order. */
const tags = (name, ...attributes) =>
	(html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? []).filter((tag) => attributes.every((attr) => attr.test(tag)));

describe('OSACA landing (rendered)', () => {
	it('has a built page to check', () => {
		assert.ok(html, 'run `pnpm build` before this suite');
	});

	it('leads with the approved OSACA logo, wordmark and tagline', () => {
		assert.equal(tags('img', /src="[^"]*osaca-logo-color\.svg"/, /alt="OSACA logo"/).length, 1);
		const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
		assert.match(heading, /<span class="visually-hidden">OSACA<\/span>/, 'the heading has a real text name');
		assert.match(heading, /<svg\b[^>]*aria-hidden="true"/, 'the wordmark artwork is decorative');
		assert.match(html, /<p\b[^>]*lang="pt-BR"[^>]*>\s*Comunidade, sem vigilância\.\s*<\/p>/);
	});

	it('explains privacy, anonymous Accounts, E2EE, self-hosting and no tracking', () => {
		for (const id of ['anonymous-accounts', 'end-to-end-encryption', 'self-hosting', 'no-tracking']) {
			assert.match(html, new RegExp(`<article [^>]*id="${id}"`), `section #${id}`);
		}
		assert.match(text, /Private Conversations/);
		assert.match(text, /Channels in a Community are not end-to-end encrypted yet/i);
	});

	it('states the unaudited status and the limits of the protection', () => {
		assert.match(text, /experimental, unaudited/i);
		assert.match(text, /global passive adversary/i);
		assert.match(text, /metadata/i);
		assert.match(text, /modified client/i);
		assert.match(text, /profiles/i);
		assert.match(text, /reported message/i);
		assert.match(text, /Calls are not yet end-to-end encrypted/i);
		assert.doesNotMatch(text, /cannot read your Private Conversations/i, 'calls in Private Conversations are readable');
		const description = tags('meta', /name="description"/)[0] ?? '';
		assert.match(description, /messages in your Private Conversations/);
		assert.doesNotMatch(
			text,
			/military[- ]grade|unbreakable|unhackable|completely (anonymous|private|secure)|100% (anonymous|private|secure)|fully secure|guaranteed/i,
		);
	});

	it('shows the delivery roadmap', () => {
		for (const phase of ['F0', 'F1', 'F2', 'F3', 'F4']) {
			assert.match(text, new RegExp(`\\b${phase}\\b`), `roadmap phase ${phase}`);
		}
	});

	it('sends visitors to the security model, self-hosting docs and source code', () => {
		assert.match(html, /<a [^>]*href="[^"]*security-model[^"]*"[^>]*>[^<]*Read the security model/);
		assert.match(html, /<a [^>]*href="[^"]*operator[^"]*"[^>]*>[^<]*Host an Instance/);
		assert.match(html, /<a [^>]*href="https:\/\/github\.com\/PJJunio\/osaca"[^>]*>[^<]*View the source/);
	});

	it('is keyboard and screen-reader friendly', () => {
		assert.match(html, /<html lang="en"/);
		assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1"/);
		assert.equal(tags('a', /class="skip-link"/, /href="#main"/).length, 1);
		assert.match(html, /<main id="main"/);
		assert.match(html, /<nav [^>]*aria-label="Primary"/);
		const toggle = tags('button', /type="button"/, /data-theme-toggle/, /aria-pressed="(true|false)"/);
		assert.equal(toggle.length, 1, 'the theme toggle exposes its state');
		assert.doesNotMatch(toggle[0], /aria-label=/, 'the visible label is the accessible name');
		assert.equal(html.match(/<h1\b/g)?.length, 1);
		for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
			assert.match(img, /\balt="/, `image has alt text: ${img}`);
		}
	});

	it('renders no visible Fluxer branding', () => {
		assert.doesNotMatch(text, /fluxer/i);
	});
});
