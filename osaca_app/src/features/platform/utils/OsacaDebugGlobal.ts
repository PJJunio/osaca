// SPDX-License-Identifier: AGPL-3.0-or-later

type OsacaDebugObject = NonNullable<Window['__OSACA_DEBUG__']>;

export function getOsacaDebugObject(): OsacaDebugObject | null {
	if (typeof window === 'undefined') {
		return null;
	}
	const existing = window.__OSACA_DEBUG__;
	if (existing === undefined || existing === null) {
		const created: OsacaDebugObject = {};
		window.__OSACA_DEBUG__ = created;
		return created;
	}
	if (typeof existing !== 'object' || Array.isArray(existing)) {
		return null;
	}
	return existing;
}
