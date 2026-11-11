// SPDX-License-Identifier: AGPL-3.0-or-later

// Repository-wide inventory of Fluxer references (issue #44).
// Run with `node --test tools/branding/FluxerInventory.test.mjs` from the repository root.

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

const repoRoot = new URL('../../', import.meta.url);

// Each entry is a path prefix that may name Fluxer, and why.
const ALLOWED = [
	['NOTICE', 'hard-fork attribution required by ADR-0001'],
	['LICENSE', 'licence text'],
	['osaca_static/LICENSE', 'CC BY-SA 4.0 notice for mirrored Fluxer-owned assets (ADR-0001)'],
	['osaca_static/THIRD_PARTY_LICENSES.md', 'third-party and Fluxer asset attribution (ADR-0001)'],
	['README.md', 'project history: OSACA is a hard fork of Fluxer'],
	['GLOSSARY.md', 'notes inherited identifiers that still say guild'],
	['TESTING.md', 'phase F0 is named "Fluxer without surveillance" in ADR-0016'],
	['docs/', 'architecture decisions and history (ADR-0001, technical survey)'],
	['tools/ci/src/desktop.rs', 'inherited desktop signing identity; replacing it needs OSACA certificates'],
	[
		'osaca_desktop/build_resources/profiles/',
		'inherited Apple provisioning profiles; same follow-up as desktop signing',
	],
	['tools/branding/', 'this inventory'],
];

const TEST_FILE = /\.test\.(mjs|ts|tsx)$/;
const SPDX_COPYRIGHT = /^.*SPDX-FileCopyrightText:.*$/gm;

function trackedFilesMentioningFluxer() {
	// git treats some text files as binary, so list every match and skip real binaries (NUL bytes) instead.
	const output = execFileSync('git', ['grep', '-l', '-i', 'fluxer', '--', '.', ':!pnpm-lock.yaml', ':!Cargo.lock'], {
		cwd: repoRoot,
		encoding: 'utf8',
	});
	return output
		.split('\n')
		.filter(Boolean)
		.filter((path) => !readFileSync(new URL(path, repoRoot)).includes(0));
}

describe('Fluxer reference inventory', () => {
	it('keeps Fluxer names out of every file outside the attribution allowlist', () => {
		const offenders = trackedFilesMentioningFluxer()
			.filter((path) => !ALLOWED.some(([prefix]) => path === prefix || path.startsWith(prefix)))
			.filter((path) => !TEST_FILE.test(path))
			.filter((path) => {
				const text = readFileSync(new URL(path, repoRoot), 'utf8').replace(SPDX_COPYRIGHT, '');
				return /fluxer/i.test(text);
			});

		assert.deepEqual(offenders, []);
	});

	it('ships no inherited Fluxer artwork', () => {
		// #4641D9 is the Fluxer brand indigo; AppIcon.icon and Assets.car hold the inherited Liquid Glass icon.
		const tracked = execFileSync('git', ['ls-files'], {cwd: repoRoot, encoding: 'utf8'}).split('\n').filter(Boolean);
		const inheritedIcons = tracked.filter((path) => /\/AppIcon\.icon\/|\/Assets\.car$/.test(path));
		const indigo = tracked
			.filter((path) => /\.(svg|json)$/.test(path) && !path.endsWith('pnpm-lock.yaml'))
			.filter((path) => /#4641d9|0\.27100,0\.25562,0\.81934/i.test(readFileSync(new URL(path, repoRoot), 'utf8')));

		assert.deepEqual(inheritedIcons, []);
		assert.deepEqual(indigo, []);
	});

	it('uses no inherited brand colours anywhere in tracked text', () => {
		// #4641D9 is the Fluxer indigo and #5865F2 the inherited blurple.
		const output = execFileSync('git', ['grep', '-l', '-i', '-E', '#4641d9|#5865f2', '--', '.', ':!pnpm-lock.yaml'], {
			cwd: repoRoot,
			encoding: 'utf8',
		});
		const offenders = output
			.split('\n')
			.filter(Boolean)
			.filter((path) => !path.startsWith('tools/branding/'))
			.filter((path) => !readFileSync(new URL(path, repoRoot)).includes(0));

		assert.deepEqual(offenders, []);
	});

	it('keeps no inherited premium artwork that nothing uses', () => {
		const tracked = execFileSync('git', ['ls-files', 'osaca_app/src/media/images'], {cwd: repoRoot, encoding: 'utf8'});
		assert.deepEqual(
			tracked.split('\n').filter((path) => /\/(operator_pass|premium)\//.test(path)),
			[],
		);
	});

	it('serves built-in profile badges rendered from the OSACA badge sources', () => {
		const assets = readFileSync(
			new URL('osaca_api/src/api/user/profile_badges/ProfileBadgeAssets.ts', repoRoot),
			'utf8',
		);
		const manifest = JSON.parse(readFileSync(new URL('osaca_static/badges/manifest.json', repoRoot), 'utf8'));

		for (const kind of ['staff', 'partner', 'bug_hunter']) {
			const hash = assets.match(new RegExp(`${kind}: '([0-9a-f]{16})'`))?.[1];
			assert.ok(hash, `${kind} has an asset hash`);
			assert.equal(manifest[kind]?.hash, hash, `${kind} hash matches the badge manifest`);
			const source = readFileSync(new URL(`osaca_static/badges/${manifest[kind].source}`, repoRoot), 'utf8');
			assert.match(source, /#102b42/i, `${kind} source uses the OSACA navy`);
			for (const ext of ['png', 'webp']) {
				readFileSync(new URL(`osaca_static/badges/${hash}.${ext}`, repoRoot));
			}
		}
	});

	it('builds each desktop macOS icon from that channel’s OSACA artwork', () => {
		for (const channel of ['stable', 'canary', 'development']) {
			const dir = new URL(`osaca_desktop/build_resources/icons-${channel}/`, repoRoot);
			const icns = readFileSync(new URL('_compiled/AppIcon.icns', dir));
			const artwork = readFileSync(new URL('1024x1024.png', dir));
			assert.equal(icns.subarray(0, 4).toString('latin1'), 'icns', `${channel} icon is an ICNS file`);
			assert.ok(icns.includes(artwork), `${channel} AppIcon.icns embeds icons-${channel}/1024x1024.png`);
		}
	});

	it('keeps the ADR-0001 attribution in NOTICE', () => {
		const notice = readFileSync(new URL('NOTICE', repoRoot), 'utf8');
		assert.match(notice, /Fluxer/);
	});
});
