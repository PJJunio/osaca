// SPDX-License-Identifier: AGPL-3.0-or-later

import {Routes} from '@app/app/Routes';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {isHandoffRequest} from '@app/features/auth/flow/auth_login_core/useDesktopHandoffFlow';
import {isAccountHandoffArrival} from '@app/features/auth/state/AccountHandoffCapture';
import Authentication from '@app/features/auth/state/Authentication';
import {safeRedirectTarget, safeRedirectTargetOrFallback} from '@app/features/auth/utils/SafeRedirect';
import {setPathQueryParams} from '@app/features/messaging/utils/MessagingUrlUtils';
import * as RouterUtils from '@app/features/navigation/utils/RouterUtils';
import {Redirect, type RouteContext, type To} from '@app/features/platform/components/router/RouterTypes';
import SessionManager from '@app/features/platform/state/AuthSession';
import {resolveDocumentURLFromRoot} from '@app/features/platform/URLOriginUtils';
import {Logger} from '@app/features/platform/utils/AppLogger';

const logger = new Logger('AuthRouteRedirectPolicy');

export type AuthRouteEnterHandler = (context: RouteContext) => Redirect | undefined;

function resolveToPath(to: To): string {
	if (typeof to === 'string') {
		return to;
	}
	const url = resolveDocumentURLFromRoot(to.to);
	if (to.search) {
		url.search = '';
		for (const [key, value] of Object.entries(to.search)) {
			if (value === undefined) continue;
			if (value === null) {
				url.searchParams.set(key, '');
			} else {
				url.searchParams.set(key, String(value));
			}
		}
	}
	if (to.hash) {
		url.hash = to.hash.startsWith('#') ? to.hash : `#${to.hash}`;
	}
	return url.pathname + url.search + url.hash;
}

function isStillOnRouteContext(context: RouteContext): boolean {
	const current = window.location.pathname + window.location.search + window.location.hash;
	return current === context.url.pathname + context.url.search + context.url.hash;
}

function applyDeferredSessionRedirect(context: RouteContext, handler: AuthRouteEnterHandler): void {
	if (!isStillOnRouteContext(context)) {
		return;
	}
	const redirect = handler(context);
	if (redirect instanceof Redirect) {
		RouterUtils.replaceWith(resolveToPath(redirect.to));
	}
}

export function isDesktopHandoffLocation(): boolean {
	return isHandoffRequest(new URLSearchParams(window.location.search));
}

export function resolveCurrentRedirectTarget(fallback: string): string {
	const queryParams = new URLSearchParams(window.location.search);
	return safeRedirectTargetOrFallback(queryParams.get('redirect_to'), fallback);
}

export function afterSessionInitialization(handler: AuthRouteEnterHandler): AuthRouteEnterHandler {
	return (context: RouteContext): Redirect | undefined => {
		if (SessionManager.isInitialized) {
			return handler(context);
		}
		void SessionManager.initialize()
			.then(() => {
				applyDeferredSessionRedirect(context, handler);
			})
			.catch((error: unknown) => {
				logger.error('Failed to initialize the auth session for a route decision', error);
			});
		return undefined;
	};
}

export function whenAuthenticated(handler: AuthRouteEnterHandler): AuthRouteEnterHandler {
	return afterSessionInitialization((context) => (Authentication.isAuthenticated ? handler(context) : undefined));
}

export const requireAuthentication: AuthRouteEnterHandler = afterSessionInitialization((context) =>
	Authentication.isAuthenticated ||
	isAccountHandoffArrival(context.url.pathname) ||
	RuntimeConfig.getSnapshotOrNull() === null ||
	RuntimeConfig.requiresSelfHostedSetup()
		? undefined
		: new Redirect(setPathQueryParams(Routes.LOGIN, {redirect_to: context.url.pathname + context.url.search})),
);

export function resolveAuthenticatedLoginEntry(): Redirect | undefined {
	if (isDesktopHandoffLocation()) {
		return undefined;
	}
	const queryParams = new URLSearchParams(window.location.search);
	const redirectTarget = safeRedirectTarget(queryParams.get('redirect_to'));
	if (redirectTarget == null || redirectTarget === '') {
		return new Redirect(Routes.ME);
	}
	return new Redirect(redirectTarget);
}

function resolveHomeEntry(): Redirect {
	return new Redirect(Routes.ME);
}

export function resolveRecoverAccountEntry(context: RouteContext): Redirect | undefined {
	return whenAuthenticated(resolveHomeEntry)(context);
}
