// SPDX-License-Identifier: AGPL-3.0-or-later

const storage = new Map<string, string>();
const mockStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, String(value)),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear(),
	get length() {
		return storage.size;
	},
	key: (i: number) => Array.from(storage.keys())[i] ?? null,
};

if (typeof globalThis.requestAnimationFrame === 'undefined') {
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
		const timer = setTimeout(() => callback(Date.now()), 16);
		if (typeof timer === 'object' && timer !== null && 'unref' in timer && typeof (timer as {unref?: unknown}).unref === 'function') {
			(timer as {unref: () => void}).unref();
		}
		return timer as unknown as number;
	};
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
	globalThis.cancelAnimationFrame = (id: number): void => {
		clearTimeout(id);
	};
}

if (typeof globalThis.window === 'undefined') {
	(globalThis as unknown as Record<string, unknown>).window = {
		...globalThis,
		innerWidth: 1024,
		innerHeight: 768,
		requestAnimationFrame: globalThis.requestAnimationFrame,
		cancelAnimationFrame: globalThis.cancelAnimationFrame,
		localStorage: mockStorage,
		sessionStorage: mockStorage,
		location: {
			pathname: '/',
			search: '',
			hash: '',
			href: 'http://localhost/',
			origin: 'http://localhost',
		},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	};
}

const originalSetInterval = globalThis.setInterval;
globalThis.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
	const timer = originalSetInterval(handler, timeout, ...args);
	if (typeof timer === 'object' && timer !== null && 'unref' in timer && typeof (timer as {unref?: unknown}).unref === 'function') {
		(timer as {unref: () => void}).unref();
	}
	return timer;
}) as typeof setInterval;

if (typeof (globalThis as unknown as {document?: unknown}).document === 'undefined') {
	const classList = {
		toggle: () => false,
		add: () => {},
		remove: () => {},
		contains: () => false,
	};
	const style = {
		removeProperty: () => {},
		setProperty: () => {},
		getPropertyValue: () => '',
	};
	(globalThis as unknown as Record<string, unknown>).document = {
		hasFocus: () => true,
		hidden: false,
		querySelector: () => null,
		querySelectorAll: () => [],
		getElementById: () => null,
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
		documentElement: {
			classList,
			style,
		},
		createElement: (tag: string) => {
			const el: Record<string, unknown> = {
				tagName: tag.toUpperCase(),
				classList,
				style,
				click: () => {},
				remove: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
			};
			return el;
		},
		body: {
			classList,
			style,
			appendChild: () => {},
			removeChild: () => {},
		},
	};
}

if (typeof (globalThis as unknown as {window?: {matchMedia?: unknown}}).window?.matchMedia === 'undefined') {
	((globalThis as unknown as {window: Record<string, unknown>}).window).matchMedia = () => ({
		matches: false,
		media: '',
		onchange: null,
		addListener: () => {},
		removeListener: () => {},
		addEventListener: () => {},
		removeEventListener: () => {},
		dispatchEvent: () => false,
	});
}

if (typeof URL.createObjectURL === 'undefined') {
	URL.createObjectURL = (_blob: Blob) => `blob:mock-url-${Math.random()}`;
}
if (typeof URL.revokeObjectURL === 'undefined') {
	URL.revokeObjectURL = () => {};
}

try {
	const RuntimeConfig = (await import('@app/features/app/state/RuntimeConfig')).default;
	(RuntimeConfig as unknown as Record<string, unknown>).retainedSnapshot = {
		apiEndpoint: 'http://localhost/api',
		inviteEndpoint: 'http://localhost/invite',
		apiPublicEndpoint: 'http://localhost/api',
		gatewayEndpoint: 'ws://localhost/gateway',
		mediaEndpoint: 'http://localhost/media',
		staticCdnEndpoint: 'http://localhost/cdn',
		marketingEndpoint: 'http://localhost',
		adminEndpoint: 'http://localhost/admin',
		giftEndpoint: 'http://localhost/gift',
		webAppEndpoint: 'http://localhost',
		apiCodeVersion: 1,
		features: {},
		community: {personal_notes_enabled: true},
		services: {},
		limits: {},
		appPublic: {branding: {}, setup: {configured: true}, legal: {}},
	};
} catch {
	// ignored
}

