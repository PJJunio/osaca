// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds build_resources/icons-<channel>/_compiled/AppIcon.icns from that channel's PNG renditions.
// ICNS stores PNG data directly for these types, so no image tooling is needed.
// Usage: node scripts/generate-macos-icns.mjs

import {readFileSync, writeFileSync} from 'node:fs';

const CHANNELS = ['stable', 'canary', 'development'];

// [ICNS type, source PNG]: the 1x and 2x slots macOS reads for each point size.
const RENDITIONS = [
	['icp4', '16x16.png'],
	['icp5', '32x32.png'],
	['ic11', '32x32.png'],
	['icp6', '64x64.png'],
	['ic12', '64x64.png'],
	['ic07', '128x128.png'],
	['ic08', '256x256.png'],
	['ic13', '256x256.png'],
	['ic09', '512x512.png'],
	['ic14', '512x512.png'],
	['ic10', '1024x1024.png'],
];

function chunk(type, data) {
	const header = Buffer.alloc(8);
	header.write(type, 0, 'latin1');
	header.writeUInt32BE(data.length + 8, 4);
	return Buffer.concat([header, data]);
}

for (const channel of CHANNELS) {
	const dir = new URL(`../build_resources/icons-${channel}/`, import.meta.url);
	const body = Buffer.concat(RENDITIONS.map(([type, file]) => chunk(type, readFileSync(new URL(file, dir)))));
	writeFileSync(new URL('_compiled/AppIcon.icns', dir), chunk('icns', body));
	console.log(`icons-${channel}/_compiled/AppIcon.icns: ${body.length + 8} bytes`);
}
