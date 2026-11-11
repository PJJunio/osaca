// SPDX-License-Identifier: AGPL-3.0-or-later

import {ErrorFallback} from '@app/features/app/components/ErrorFallback';
import {AppSkeleton} from '@app/features/app/components/skeleton/AppSkeleton';
import {EmptyStateView} from '@app/features/channel/components/friends/EmptyStateView';
import {RouterProvider} from '@app/features/platform/components/router/RouterReact';
import type {Router, RouterState} from '@app/features/platform/components/router/RouterTypes';
import type React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';

function renderAt(pathname: string, element: React.ReactElement): string {
	const state: RouterState = {location: new URL(pathname, 'http://localhost'), matches: [], navigating: false};
	const router = {getState: () => state, subscribe: () => () => {}, destroy: () => {}} as unknown as Router;
	return renderToStaticMarkup(<RouterProvider router={router}>{element}</RouterProvider>);
}

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

	it('announces the loading shell to assistive technology while it is busy', () => {
		const html = renderAt('/channels/@me', <AppSkeleton effectivePathname="/channels/@me" />);

		expect(html).toMatch(/^<flx-app-skeleton[^>]*role="status"/);
		expect(html).toMatch(/^<flx-app-skeleton[^>]*aria-busy="true"/);
		expect(html).toMatch(/^<flx-app-skeleton[^>]*aria-label="Loading OSACA"/);
	});

	it('announces the crash screen as an alert with a labelled heading', () => {
		const html = renderToStaticMarkup(<ErrorFallback error={new Error('boom')} />);

		expect(html).toMatch(/<div[^>]*role="alert"/);
		expect(html).toMatch(/<div[^>]*role="alert"[^>]*aria-labelledby="osaca-error-fallback-title"/);
		expect(html).toMatch(/<h1[^>]*id="osaca-error-fallback-title"[^>]*>The app crashed<\/h1>/);
	});

	it('shows the approved OSACA logo, named for assistive technology, on the crash screen', () => {
		const html = renderToStaticMarkup(<ErrorFallback error={new Error('boom')} />);
		const icon = html.match(/<svg\b[^>]*data-flx="app\.error-fallback\.osaca-icon"[^>]*>[\s\S]*?<\/svg>/)?.[0] ?? '';

		expect(icon).toMatch(/role="img"/);
		expect(icon).toMatch(/aria-label="OSACA application icon"/);
		expect(icon).toContain('OSACA Pagoda');
	});
});
