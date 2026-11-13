// SPDX-License-Identifier: AGPL-3.0-or-later

// ADR-0010 removed message lookup and search, DM and relationship listing, IP and location views, email changes,
// MFA reset and user archives from the admin panel, and the Operator cannot recover an Account (issue #50).

import assert from 'node:assert/strict';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {describe, it} from 'node:test';

const srcRoot = new URL('./', import.meta.url);

function rustFiles(dir) {
	return readdirSync(dir).flatMap((name) => {
		const entry = new URL(name, dir);
		if (statSync(entry).isDirectory()) return name === 'generated' ? [] : rustFiles(new URL(`${name}/`, dir));
		return name.endsWith('.rs') ? [entry] : [];
	});
}

// What the Operator sees and can request: templates and routes. The API client may still carry the fields.
const sources = [...rustFiles(new URL('templates/', srcRoot)), ...rustFiles(new URL('routes/', srcRoot))].map(
	(file) => ({
		path: file.pathname.split('/src/').pop(),
		text: readFileSync(file, 'utf8'),
	}),
);

function offenders(pattern) {
	return sources.filter(({text}) => pattern.test(text)).map(({path}) => path);
}

describe('admin panel operational scope (ADR-0010)', () => {
	it('links to no message lookup, browse or search tool', () => {
		assert.deepEqual(offenders(/\/messages[?'"]/), []);
	});

	it('offers no DM, relationship or archive views', () => {
		assert.deepEqual(offenders(/tab=(dm_history|group_dm|relationships|archives)|"\/archives"/), []);
	});

	it('shows no IP address, reverse DNS or location of an Account', () => {
		assert.deepEqual(
			offenders(/last_active_ip|last_active_location|\.client_ip\b|client_ip_reverse|client_location|ip_reverse/),
			[],
		);
	});

	it('offers no MFA reset or Account recovery (the Operator cannot recover an Account)', () => {
		assert.deepEqual(offenders(/disable_mfa|password_reset|revoke_recovery_kit|webauthn_credential/), []);
	});

	it('offers no IP blocklist (ADR-0009: IP bans disappear)', () => {
		assert.deepEqual(offenders(/ip-bans|IP Bans|BAN_IP_/), []);
	});

	it('offers no search of Accounts by IP address', () => {
		assert.deepEqual(offenders(/Last active IP address|\/users\?ip=/), []);
	});
});
