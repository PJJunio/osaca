// SPDX-License-Identifier: AGPL-3.0-or-later

import {createAuthHarness, createTestAccount, loginAccount} from '@app/api/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

interface HandoffInitiateResponse {
	code: string;
	poll_secret: string;
}

describe('Auth desktop handoff negative paths', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createAuthHarness();
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});
	it('rejects handoff complete with bad token', async () => {
		const account = await createTestAccount(harness);
		const login = await loginAccount(harness, account);
		const initResp = await createBuilderWithoutAuth<HandoffInitiateResponse>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();
		await createBuilderWithoutAuth(harness).get(`/auth/handoff/${initResp.code}/info`).execute();
		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.body({
				code: initResp.code,
				token: 'bad-token',
				user_id: login.userId,
			})
			.expect(HTTP_STATUS.UNAUTHORIZED, APIErrorCodes.INVALID_TOKEN)
			.execute();
	});
	it('rejects handoff complete before the code is approved through info lookup', async () => {
		const account = await createTestAccount(harness);
		const login = await loginAccount(harness, account);
		const initResp = await createBuilderWithoutAuth<HandoffInitiateResponse>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();
		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.header('Authorization', login.token)
			.body({
				code: initResp.code,
				user_id: login.userId,
			})
			.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.INVALID_HANDOFF_CODE)
			.execute();
	});

	it('says a code was already used to anyone holding it', async () => {
		const approverIp = '198.51.100.41';
		const strangerIp = '198.51.100.42';
		const account = await createTestAccount(harness);
		const login = await loginAccount(harness, account);
		const initResp = await createBuilderWithoutAuth<HandoffInitiateResponse>(harness)
			.post('/auth/handoff/initiate')
			.body(null)
			.execute();
		await createBuilderWithoutAuth(harness)
			.get(`/auth/handoff/${initResp.code}/info`)
			.header('x-forwarded-for', approverIp)
			.execute();
		await createBuilderWithoutAuth(harness)
			.post('/auth/handoff/complete')
			.header('x-forwarded-for', approverIp)
			.header('Authorization', login.token)
			.body({code: initResp.code, user_id: login.userId})
			.expect(204)
			.execute();
		for (const ip of [approverIp, strangerIp]) {
			await createBuilderWithoutAuth(harness)
				.get(`/auth/handoff/${initResp.code}/info`)
				.header('x-forwarded-for', ip)
				.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.HANDOFF_CODE_ALREADY_USED)
				.execute();
			await createBuilderWithoutAuth(harness)
				.post('/auth/handoff/complete')
				.header('x-forwarded-for', ip)
				.header('Authorization', login.token)
				.body({code: initResp.code, user_id: login.userId})
				.expect(HTTP_STATUS.BAD_REQUEST, APIErrorCodes.HANDOFF_CODE_ALREADY_USED)
				.execute();
		}
	});
});
