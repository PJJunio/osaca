// SPDX-License-Identifier: AGPL-3.0-or-later

// macOS signing is opt-in (issue #53): OSACA has no Apple Developer certificate yet, so a build without the
// signing variables is unsigned and never borrows an inherited identity or provisioning profile.
// Run with `node --test scripts/MacSigningConfig.test.mjs` from osaca_desktop.

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {describe, it} from 'node:test';

const desktopRoot = new URL('../', import.meta.url);
const SIGNING_ENV = [
	'APPLE_ID',
	'APPLE_APP_SPECIFIC_PASSWORD',
	'APPLE_TEAM_ID',
	'OSACA_MACOS_PROVISIONING_PROFILE',
	'OSACA_MACOS_ASSOCIATED_DOMAINS',
];

function macConfig(channel, extraEnv = {}) {
	const env = {...process.env, BUILD_CHANNEL: channel, ELECTRON_ARCH: 'x64', ...extraEnv};
	for (const name of SIGNING_ENV) {
		if (!(name in extraEnv)) delete env[name];
	}
	const output = execFileSync(
		process.execPath,
		['-e', "process.stdout.write(JSON.stringify(require('./electron-builder.config.cjs').mac))"],
		{cwd: desktopRoot, env, encoding: 'utf8'},
	);
	return JSON.parse(output);
}

describe('macOS signing configuration', () => {
	for (const channel of ['stable', 'canary']) {
		it(`builds ${channel} unsigned when no signing variables are set`, () => {
			const mac = macConfig(channel);
			assert.equal(mac.notarize, false);
			assert.equal(mac.identity, null);
			assert.equal(mac.sign?.provisioningProfile, undefined);
		});
	}

	it('signs and notarizes with the configured identity and provisioning profile', () => {
		const mac = macConfig('stable', {
			APPLE_ID: 'release@osaca.example',
			APPLE_APP_SPECIFIC_PASSWORD: 'app-specific',
			APPLE_TEAM_ID: 'ABCDE12345',
			OSACA_MACOS_PROVISIONING_PROFILE: '/runner/profiles/osaca.provisionprofile',
		});
		assert.equal(mac.notarize, true);
		assert.notEqual(mac.identity, null);
		assert.equal(mac.sign.provisioningProfile, '/runner/profiles/osaca.provisionprofile');
	});

	for (const channel of ['stable', 'canary']) {
		it(`claims no app identity or associated domain in unsigned ${channel} builds`, () => {
			const entitlements = readFileSync(new URL(macConfig(channel).sign.entitlements, desktopRoot), 'utf8');
			assert.doesNotMatch(entitlements, /com\.apple\.application-identifier/);
			assert.doesNotMatch(entitlements, /com\.apple\.developer\.associated-domains/);
		});
	}

	it('derives the app identity and associated domains from the signing configuration', () => {
		const mac = macConfig('canary', {
			APPLE_ID: 'release@osaca.example',
			APPLE_APP_SPECIFIC_PASSWORD: 'app-specific',
			APPLE_TEAM_ID: 'ABCDE12345',
			OSACA_MACOS_PROVISIONING_PROFILE: '/runner/profiles/osaca-canary.provisionprofile',
			OSACA_MACOS_ASSOCIATED_DOMAINS: 'chat.example.org, web.example.org',
		});
		const entitlements = readFileSync(mac.sign.entitlements, 'utf8');
		assert.match(
			entitlements,
			/<key>com\.apple\.application-identifier<\/key>\s*<string>ABCDE12345\.app\.osaca\.canary<\/string>/,
		);
		assert.match(entitlements, /<string>webcredentials:chat\.example\.org<\/string>/);
		assert.match(entitlements, /<string>webcredentials:web\.example\.org<\/string>/);
		assert.match(entitlements, /com\.apple\.security\.device\.camera/, 'keeps the base entitlements');
	});

	it('refuses a partial signing configuration instead of building unsigned', () => {
		assert.throws(
			() => macConfig('stable', {APPLE_ID: 'release@osaca.example', APPLE_TEAM_ID: 'ABCDE12345'}),
			/APPLE_APP_SPECIFIC_PASSWORD/,
		);
	});

	it('never signs a development build', () => {
		const mac = macConfig('development', {
			APPLE_ID: 'release@osaca.example',
			APPLE_APP_SPECIFIC_PASSWORD: 'app-specific',
			APPLE_TEAM_ID: 'ABCDE12345',
			OSACA_MACOS_PROVISIONING_PROFILE: '/runner/profiles/osaca.provisionprofile',
		});
		assert.equal(mac.notarize, false);
		assert.equal(mac.identity, null);
	});

	it('ships no inherited provisioning profiles', () => {
		for (const profile of ['OSACA.provisionprofile', 'Osaca_Canary.provisionprofile']) {
			assert.equal(existsSync(new URL(`build_resources/profiles/${profile}`, desktopRoot)), false, profile);
		}
	});
});
