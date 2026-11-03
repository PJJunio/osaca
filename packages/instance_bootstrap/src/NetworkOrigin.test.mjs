// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {describe, test} from 'node:test';

const {
	HTTP_NETWORK_PROTOCOLS,
	WEBSOCKET_NETWORK_PROTOCOLS,
	normalizeCanonicalNetworkEndpoint,
	normalizeHTTPNetworkOrigin,
} = await import('./NetworkOrigin.ts');

const GATEWAY_RULE = {protocols: WEBSOCKET_NETWORK_PROTOCOLS, allowPath: true, allowRelative: false};
const API_RULE = {protocols: HTTP_NETWORK_PROTOCOLS, allowPath: true, allowRelative: true};

describe('canonicalising a network origin', () => {
	test('a written default port collapses to the same origin as the bare host', () => {
		assert.equal(normalizeHTTPNetworkOrigin('osaca.example:443'), 'https://osaca.example');
		assert.equal(normalizeHTTPNetworkOrigin('https://osaca.example:443'), 'https://osaca.example');
		assert.equal(normalizeHTTPNetworkOrigin('http://osaca.example:80'), 'http://osaca.example');
		assert.equal(normalizeHTTPNetworkOrigin('https://[::1]:443'), 'https://[::1]');
	});

	test('one origin has one canonical form, the one URL.origin agrees with', () => {
		for (const value of ['osaca.example', 'osaca.example:443', 'https://osaca.example:443', 'https://osaca.example/']) {
			assert.equal(
				normalizeHTTPNetworkOrigin(value),
				'https://osaca.example',
				`${value} must not gain a second canonical form`,
			);
		}
		for (const value of ['osaca.example:443', 'https://osaca.example:8443', 'http://osaca.example:80', 'http://[::1]:8080']) {
			const normalized = normalizeHTTPNetworkOrigin(value);
			assert.equal(new URL(normalized).origin, normalized, `${value} must canonicalise the way URL.origin does`);
		}
	});

	test('a host slices off the canonical origin without a port riding along', () => {
		const origin = normalizeHTTPNetworkOrigin('web.osaca.example:443');
		assert.equal(origin.slice('https://'.length), 'web.osaca.example');
	});

	test('a non default port is kept', () => {
		assert.equal(normalizeHTTPNetworkOrigin('osaca.example:8443'), 'https://osaca.example:8443');
		assert.equal(normalizeHTTPNetworkOrigin('http://localhost:3000'), 'http://localhost:3000');
		assert.equal(normalizeHTTPNetworkOrigin('https://[::1]:8443'), 'https://[::1]:8443');
	});

	test('a leading zero port is normalised the way URL normalises it', () => {
		assert.equal(normalizeHTTPNetworkOrigin('https://osaca.example:0443'), 'https://osaca.example');
		assert.equal(normalizeHTTPNetworkOrigin('https://osaca.example:08443'), 'https://osaca.example:8443');
	});

	test('port zero, credentials, a path, a query and a fragment are all refused', () => {
		assert.equal(normalizeHTTPNetworkOrigin('https://osaca.example:0'), null);
		assert.equal(normalizeHTTPNetworkOrigin('https://user:pass@osaca.example'), null);
		assert.equal(normalizeHTTPNetworkOrigin('https://osaca.example/api'), null);
		assert.equal(normalizeHTTPNetworkOrigin('https://osaca.example?a=1'), null);
		assert.equal(normalizeHTTPNetworkOrigin('https://osaca.example#a'), null);
		assert.equal(normalizeHTTPNetworkOrigin('//osaca.example'), null);
		assert.equal(normalizeHTTPNetworkOrigin('wss://osaca.example'), null);
		assert.equal(normalizeHTTPNetworkOrigin(42), null);
	});
});

describe('canonicalising an endpoint that carries a path', () => {
	test('a websocket endpoint drops its written default port too', () => {
		assert.equal(
			normalizeCanonicalNetworkEndpoint('wss://gateway.osaca.example:443', GATEWAY_RULE),
			'wss://gateway.osaca.example',
		);
		assert.equal(normalizeCanonicalNetworkEndpoint('ws://localhost:80/ws', GATEWAY_RULE), 'ws://localhost/ws');
		assert.equal(
			normalizeCanonicalNetworkEndpoint('wss://gateway.osaca.example:8443', GATEWAY_RULE),
			'wss://gateway.osaca.example:8443',
		);
	});

	test('an api endpoint keeps its path and still collapses the default port', () => {
		assert.equal(
			normalizeCanonicalNetworkEndpoint('https://osaca.example:443/api/v1/', API_RULE),
			'https://osaca.example/api/v1',
		);
		assert.equal(normalizeCanonicalNetworkEndpoint('/api', API_RULE), '/api');
	});
});
