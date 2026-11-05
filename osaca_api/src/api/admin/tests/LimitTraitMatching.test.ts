// SPDX-License-Identifier: AGPL-3.0-or-later

import type {TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {getConfig} from '@app/api/Config';
import {getInstanceConfigRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {fetchUserMe} from '@app/api/user/tests/UserTestUtils';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {DEFAULT_LIMITS} from '@osaca/limits/src/LimitDefaults';
import {expandWireFormat} from '@osaca/limits/src/LimitDiffer';
import {resolveLimits} from '@osaca/limits/src/LimitResolver';
import type {LimitConfigGetResponse} from '@osaca/schema/src/domains/admin/AdminSchemas';
import type {WellKnownOsacaResponse} from '@osaca/schema/src/domains/instance/InstanceSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import type {z} from 'zod';

type LimitConfigResponse = z.infer<typeof LimitConfigGetResponse>;

describe('limit rules and traits on a self-hosted instance', () => {
	let harness: ApiTestHarness;
	let admin: TestAccount;
	let originalSelfHosted: boolean;

	beforeAll(async () => {
		originalSelfHosted = getConfig().instance.selfHosted;
		getConfig().instance.selfHosted = true;
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		await getInstanceConfigRepository().setAppPublicConfig({setup: {configured: true}});
		admin = await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.USER_LOOKUP,
			AdminACLs.USER_UPDATE_TRAITS,
			AdminACLs.INSTANCE_CONFIG_UPDATE,
			AdminACLs.INSTANCE_LIMIT_CONFIG_VIEW,
			AdminACLs.INSTANCE_LIMIT_CONFIG_UPDATE,
		]);
	});

	afterAll(async () => {
		await harness.shutdown();
		getConfig().instance.selfHosted = originalSelfHosted;
	});

	async function getLimitConfig(): Promise<LimitConfigResponse> {
		return await createBuilder<LimitConfigResponse>(harness, admin.token).get('/admin/limit-config').execute();
	}

	async function saveConfig(transform: (config: LimitConfigResponse['limit_config']) => object): Promise<void> {
		const {limit_config: config} = await getLimitConfig();
		await createBuilder(harness, admin.token)
			.put('/admin/limit-config')
			.body({limit_config: transform(config)})
			.execute();
	}

	async function setTraits(account: TestAccount, traits: Array<string>): Promise<void> {
		await createBuilder(harness, admin.token).put(`/admin/users/${account.userId}/traits`).body({traits}).execute();
	}

	async function changeTag(account: TestAccount, discriminator: string): Promise<number> {
		const {response} = await createBuilder(harness, account.token)
			.patch('/users/@me')
			.body({discriminator, password: account.password})
			.executeRaw();
		return response.status;
	}

	async function clientLimits(account: TestAccount) {
		const {json: me} = await fetchUserMe(harness, account.token);
		const discovery = await createBuilderWithoutAuth<WellKnownOsacaResponse>(harness)
			.get('/.well-known/osaca')
			.execute();
		return {
			traits: me.traits,
			limits: resolveLimits(expandWireFormat(discovery.limits), {
				traits: new Set(me.traits),
				guildFeatures: new Set(),
			}).limits,
		};
	}

	function withoutModifiedFields(config: LimitConfigResponse['limit_config']) {
		return config.rules.map(({modifiedFields: _modifiedFields, ...rule}) => rule);
	}

	async function saveSupporterRule(): Promise<void> {
		await saveConfig((config) => ({
			traitDefinitions: [...config.traitDefinitions, 'Supporter'],
			rules: [
				...withoutModifiedFields(config).map((rule) =>
					rule.id === 'default' ? {...rule, limits: {...rule.limits, feature_custom_discriminator: 0}} : rule,
				),
				{id: 'supporter', filters: {traits: ['Supporter']}, limits: {feature_custom_discriminator: 1}},
			],
		}));
	}

	it('gives every account the default limits', async () => {
		const member = await createTestAccount(harness);
		const {limits} = await clientLimits(member);
		expect(limits.feature_animated_banner).toBe(1);
		expect(limits.max_guilds).toBe(DEFAULT_LIMITS.max_guilds);
		expect(await changeTag(member, '4244')).toBe(200);
	});

	it('gives a trait rule to an account that an admin gave the trait, whatever its case', async () => {
		await saveSupporterRule();
		const member = await createTestAccount(harness);
		expect(await changeTag(member, '4242')).toBe(400);
		await setTraits(member, ['SUPPORTER']);
		expect(await changeTag(member, '4243')).toBe(200);
		const {traits, limits} = await clientLimits(member);
		expect(traits).toEqual(['supporter']);
		expect(limits.feature_custom_discriminator).toBe(1);
	});

	it('keeps an edit to a trait rule after saving', async () => {
		await saveSupporterRule();
		await saveConfig((config) => ({
			traitDefinitions: config.traitDefinitions,
			rules: withoutModifiedFields(config).map((rule) =>
				rule.id === 'supporter' ? {...rule, limits: {...rule.limits, max_attachment_file_size: 123_456_789}} : rule,
			),
		}));
		const supporter = (await getLimitConfig()).limit_config.rules.find((rule) => rule.id === 'supporter');
		expect(supporter?.limits.max_attachment_file_size).toBe(123_456_789);
	});
});
