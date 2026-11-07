// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, createUniqueUsername} from '@app/api/auth/tests/AuthTestUtils';
import {getInstanceConfigRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {Headers} from '@osaca/constants/src/Headers';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface Registered {
	token: string;
	user_id: string;
}

describe('Tier gates on joins', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness();
	});
	beforeEach(async () => {
		await harness.reset();
		await getInstanceConfigRepository().updateAccountsConfig({interaction_tier: 'enforced'});
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	async function createUnclaimed(): Promise<Registered> {
		return await createBuilderWithoutAuth<Registered>(harness)
			.post('/auth/register')
			.body({username: createUniqueUsername('shopper'), consent: true})
			.execute();
	}

	async function createInvite(): Promise<string> {
		const owner = await createTestAccount(harness);
		const guild = await createBuilder<{system_channel_id: string}>(harness, owner.token)
			.post('/guilds')
			.body({name: 'Gate Guild'})
			.execute();
		const invite = await createBuilder<{code: string}>(harness, owner.token)
			.post(`/channels/${guild.system_channel_id}/invites`)
			.body({})
			.execute();
		return invite.code;
	}

	it('refuses unclaimed accounts a full join on every client once visits are on', async () => {
		const code = await createInvite();
		const plain = await createUnclaimed();
		await createBuilder(harness, plain.token).post(`/invites/${code}`).body(null).execute();
		await getInstanceConfigRepository().updateGuildVisitsConfig({enabled: true, user_basis_points: 10000});
		const visitor = await createUnclaimed();
		const refused = await createBuilder<{action: string; tier: string}>(harness, visitor.token)
			.post(`/invites/${code}`)
			.header(Headers.X_OSACA_CAPABILITIES, 'guild_visits')
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.ACCOUNT_VERIFICATION_REQUIRED)
			.execute();
		expect(refused).toMatchObject({action: 'guild_join', tier: 'unclaimed'});
		await createBuilder(harness, visitor.token)
			.post(`/invites/${code}`)
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.ACCOUNT_VERIFICATION_REQUIRED)
			.execute();
		const member = await createTestAccount(harness);
		await createBuilder(harness, member.token).post(`/invites/${code}`).body(null).execute();
	});

	it('lets older clients join when the instance limits the gate to visits clients', async () => {
		const code = await createInvite();
		await getInstanceConfigRepository().updateGuildVisitsConfig({enabled: true, user_basis_points: 10000});
		await getInstanceConfigRepository().updateAccountsConfig({guild_join_gate: 'visits_capable'});
		const visitor = await createUnclaimed();
		await createBuilder(harness, visitor.token)
			.post(`/invites/${code}`)
			.header(Headers.X_OSACA_CAPABILITIES, 'guild_visits')
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.ACCOUNT_VERIFICATION_REQUIRED)
			.execute();
		await createBuilder(harness, visitor.token).post(`/invites/${code}`).body(null).execute();
	});
});
