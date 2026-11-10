// SPDX-License-Identifier: AGPL-3.0-or-later

// Checks the built site. Run `npx astro build` first; the suite reads dist/client.

import assert from 'node:assert/strict';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {describe, it} from 'node:test';

const clientRoot = new URL('../../dist/client/', import.meta.url);
const page = (path) => readFileSync(new URL(`${path}index.html`, clientRoot), 'utf8');
const visibleText = (html) =>
	html
		.replace(/<script[\s\S]*?<\/script>/g, ' ')
		.replace(/<style[\s\S]*?<\/style>/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ');

function htmlPages(dir) {
	return readdirSync(dir).flatMap((name) => {
		const entry = new URL(name, dir);
		if (statSync(entry).isDirectory()) {
			return htmlPages(new URL(`${name}/`, dir));
		}
		return name.endsWith('.html') ? [entry] : [];
	});
}

describe('OSACA documentation (rendered)', () => {
	it('has a built site to check', () => {
		assert.ok(existsSync(new URL('index.html', clientRoot)), 'run `npx astro build` before this suite');
	});

	it('publishes a security model page that states the audit status and the limits of the protection', () => {
		const text = visibleText(page('security-model/'));

		assert.match(text, /experimental, unaudited/i);
		assert.match(text, /untrusted Operator/i);
		assert.match(text, /Private Conversations/);
		assert.match(text, /Community Channels are not end-to-end encrypted yet/i);
		assert.match(text, /global passive adversary/i);
		assert.match(text, /no protection/i);
		assert.doesNotMatch(text, /military[- ]grade|unbreakable|completely anonymous|100% (secure|private)/i);
	});

	it('links the security model from the sidebar of every page and from the introduction', () => {
		for (const path of ['', 'authentication/', 'operator/']) {
			assert.match(
				page(path),
				/<a href="[^"]*\/security-model\/"[^>]*>(?:\s|<span[^>]*>)*Security model/,
				`sidebar on /${path}`,
			);
		}
		assert.match(visibleText(page('')), /Security model/);
	});

	it('renders no visible Fluxer branding on any page', () => {
		const offenders = htmlPages(clientRoot).filter((file) => /fluxer/i.test(visibleText(readFileSync(file, 'utf8'))));

		assert.deepEqual(
			offenders.map((file) => file.pathname),
			[],
		);
	});

	it('offers keyboard users a skip link and a theme control on every page', () => {
		for (const path of ['', 'security-model/', 'operator/']) {
			const html = page(path);
			assert.match(html, /<a [^>]*href="#_top"[^>]*>\s*Skip to content\s*<\/a>/, `skip link on /${path}`);
			assert.match(
				html,
				/<starlight-theme-select|data-theme-select|aria-label="Select theme"/i,
				`theme control on /${path}`,
			);
		}
	});
});
