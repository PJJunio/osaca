// SPDX-License-Identifier: AGPL-3.0-or-later

// Shared by the surface style tests: resolves var(--osaca-color-*) to the hex values in
// packages/brand/css/palette.css so contrast checks see real colours.

import {readFileSync} from 'node:fs';

const PALETTE = Object.fromEntries(
	[
		...readFileSync(new URL('../../packages/brand/css/palette.css', import.meta.url), 'utf8').matchAll(
			/--(osaca-color-[a-z-]+): (#[0-9a-f]{6});/g,
		),
	].map(([, name, hex]) => [name, hex]),
);

export function resolvePalette(text) {
	return text.replace(/var\(--(osaca-color-[a-z-]+)\)/g, (match, name) => PALETTE[name] ?? match);
}
