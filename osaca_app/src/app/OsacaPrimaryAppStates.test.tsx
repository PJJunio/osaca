// SPDX-License-Identifier: AGPL-3.0-or-later

import {ErrorFallback} from '@app/features/app/components/ErrorFallback';
import {EmptyStateView} from '@app/features/channel/components/friends/EmptyStateView';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';

describe('OSACA primary app states', () => {
	it('announces an empty state politely and hides its decorative icon from assistive technology', () => {
		const html = renderToStaticMarkup(
			<EmptyStateView title="No friends yet" subtitle="Add someone to start talking." />,
		);

		expect(html).toMatch(/^<div[^>]*role="status"/);
		expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
		expect(html).toContain('<h2');
		expect(html).toContain('No friends yet');
		expect(html).toContain('Add someone to start talking.');
	});

	it('announces the crash screen as an alert with a labelled heading', () => {
		const html = renderToStaticMarkup(<ErrorFallback error={new Error('boom')} />);

		expect(html).toMatch(/<div[^>]*role="alert"/);
		expect(html).toMatch(/<div[^>]*role="alert"[^>]*aria-labelledby="osaca-error-fallback-title"/);
		expect(html).toMatch(/<h1[^>]*id="osaca-error-fallback-title"[^>]*>The app crashed<\/h1>/);
	});
});
