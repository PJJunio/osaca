// SPDX-License-Identifier: AGPL-3.0-or-later

import {DEFAULT_LIMITS} from '@osaca/limits/src/LimitDefaults';

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36);
}

export function computeDefaultsHash(): string {
	return simpleHash(JSON.stringify(DEFAULT_LIMITS));
}
