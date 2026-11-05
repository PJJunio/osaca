// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import type {UserPrivateResponse} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {beforeEach, describe, expect, test} from 'vitest';

interface OAuth2TokenResponse {
	token: string;
	user_id: string;
	scopes: Array<string>;
	application_id: string;
}

async function createOAuth2Token(
	harness: ApiTestHarness,
	userId: string,
	scopes: Array<string>,
): Promise<OAuth2TokenResponse> {
	return createBuilder<OAuth2TokenResponse>(harness, '')
		.post('/test/oauth2/access-token')
		.body({user_id: userId, scopes})
		.execute();
}

describe('Bearer token scope filtering on /users/@me', () => {
	let harness: ApiTestHarness;
	let account: TestAccount;
	beforeEach(async () => {
		harness = await createApiTestHarness();
		account = await createTestAccount(harness);
	});
	test('bearer token with identify scope strips sensitive fields', async () => {
		const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);
		const json = await createBuilder<UserPrivateResponse>(harness, `Bearer ${oauth2Token.token}`)
			.get('/users/@me')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(json.id).toBe(account.userId);
		expect(json.username).toBe(account.username);
		expect(json.email).toBeNull();
		expect(json.acls).toEqual([]);
		expect(json.traits).toEqual([]);
		expect(json.mfa_enabled).toBe(false);
		expect(json.authenticator_types).toBeUndefined();
		expect(json.password_last_changed_at).toBeNull();
		expect(json.email_bounced).toBeUndefined();
		expect(json.nsfw_allowed).toBe(false);
		expect(json.pending_bulk_message_deletion).toBeNull();
	});
	test('bearer token with identify and email scope returns email but strips other sensitive fields', async () => {
		const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify', 'email']);
		const json = await createBuilder<UserPrivateResponse>(harness, `Bearer ${oauth2Token.token}`)
			.get('/users/@me')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(json.id).toBe(account.userId);
		expect(json.email).toBe(account.email);
		expect(json.acls).toEqual([]);
		expect(json.traits).toEqual([]);
		expect(json.mfa_enabled).toBe(false);
		expect(json.password_last_changed_at).toBeNull();
	});
});
