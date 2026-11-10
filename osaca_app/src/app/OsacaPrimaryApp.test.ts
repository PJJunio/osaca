// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {describe, it} from 'vitest';

const appRoot = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, appRoot), 'utf8');

const INHERITED_SPACE_PALETTE = /#05040d|#080616|#0d0a1c|rgb\(5 4 13/i;

describe('OSACA primary app experience', () => {
	it('authentication surfaces use the OSACA navy instead of the inherited space palette', () => {
		const authLayout = read('src/features/app/components/layout/AuthLayout.module.css');
		const spaceBackground = read('src/features/ui/space_background/SpaceBackground.module.css');
		const authPage = read('src/features/auth/flow/AuthPageStyles.module.css');

		assert.doesNotMatch(authLayout, INHERITED_SPACE_PALETTE);
		assert.doesNotMatch(spaceBackground, INHERITED_SPACE_PALETTE);
		assert.match(authLayout, /var\(--osaca-color-navy/);
		assert.match(authLayout, /var\(--osaca-surface-raised/);
		assert.doesNotMatch(authPage, /#4752c4/i);
	});

	it('Community Channels and Private Conversations share the OSACA navigation surfaces', () => {
		const channelList = read('src/features/app/components/layout/ChannelListContent.module.css');
		const privateConversations = read('src/features/channel/components/direct_message/DirectMessageList.module.css');

		assert.match(channelList, /var\(--osaca-surface-subnavigation/);
		assert.match(privateConversations, /var\(--osaca-surface-subnavigation/);
		assert.match(privateConversations, /var\(--osaca-status-danger/);
	});

	it('the Channel header and message feed sit on the themed OSACA page surface', () => {
		const header = read('src/features/channel/components/ChannelHeader.module.css');
		const feed = read('src/features/channel/components/ChannelMessages.module.css');

		for (const css of [header, feed]) {
			assert.match(css, /var\(--osaca-surface-page/);
			assert.doesNotMatch(css, /:\s*var\(--chat-canvas-bg/);
		}
		assert.match(header, /var\(--osaca-status-success/);
		assert.match(feed, /var\(--osaca-status-danger/);
		assert.match(feed, /var\(--osaca-action-primary/);
	});

	it('settings use the OSACA navigation, page and danger tokens', () => {
		const settings = read('src/features/app/components/dialogs/shared/SettingsModalLayout.module.css');

		assert.match(settings, /background: var\(--osaca-surface-subnavigation/);
		assert.match(settings, /var\(--osaca-surface-page/);
		assert.match(settings, /var\(--osaca-status-danger/);
	});

	it('empty, error and not-found states use OSACA typography and content tokens', () => {
		const states = [
			'src/features/channel/components/friends/EmptyStateView.module.css',
			'src/features/app/components/ErrorFallback.module.css',
			'src/features/app/components/pages/NotFoundPage.module.css',
		].map(read);

		for (const css of states) {
			assert.match(css, /font-family: var\(--font-display\)/);
			assert.match(css, /var\(--osaca-content-primary/);
			assert.match(css, /var\(--osaca-content-secondary/);
		}
	});

	it('app source and the HTML shell carry no visible Fluxer branding', () => {
		const sourceFiles = (dir: URL): Array<URL> =>
			readdirSync(dir).flatMap((name) => {
				const entry = new URL(name, dir);
				if (statSync(entry).isDirectory()) {
					return name === 'locales' ? [] : sourceFiles(new URL(`${name}/`, dir));
				}
				return /\.(tsx?|css|html)$/.test(name) && !name.endsWith('.test.ts') ? [entry] : [];
			});

		const offenders = [new URL('index.html', appRoot), ...sourceFiles(new URL('src/', appRoot))].filter((file) =>
			/fluxer/i.test(readFileSync(file, 'utf8')),
		);

		assert.deepEqual(
			offenders.map((file) => file.pathname),
			[],
		);
	});
});
