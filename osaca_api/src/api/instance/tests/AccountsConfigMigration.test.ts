// SPDX-License-Identifier: AGPL-3.0-or-later

import {getConfig} from '@app/api/Config';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {InstanceConfigRepository} from '@app/api/instance/InstanceConfigRepository';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {CleanupModes, GuildJoinGates, LastSessionCleanupModes} from '@osaca/constants/src/AccountConfigConstants';
import {MockKVProvider} from '@pkgs/kv_client/src/testing/MockKVProvider';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const ACCOUNTS_CONFIG_KEY = 'accounts_config';

const LEGACY_HOSTED_ACCOUNTS = {
	date_of_birth_enforcement: 'new_accounts',
	interaction_tier: 'legacy',
	guild_join_gate: 'always',
	abandoned_account_cleanup: false,
};

describe('account config migrations', () => {
	const config = getConfig();
	const repositories: Array<InstanceConfigRepository> = [];
	let originalSelfHosted: boolean;

	beforeEach(() => {
		setCassandraQueryExecutorForTesting(new InMemoryCassandraQueryExecutor());
		originalSelfHosted = config.instance.selfHosted;
	});

	afterEach(() => {
		for (const repository of repositories) {
			repository.clearCacheForTesting();
			repository.shutdown();
		}
		repositories.length = 0;
		config.instance.selfHosted = originalSelfHosted;
	});

	function createRepository(): InstanceConfigRepository {
		const repository = new InstanceConfigRepository(new MockKVProvider());
		repositories.push(repository);
		return repository;
	}

	describe('cleanup', () => {
		it('turns both cleanup policies on with the defaults from a stored true', async () => {
			const repository = createRepository();
			await repository.setConfig(ACCOUNTS_CONFIG_KEY, JSON.stringify({abandoned_account_cleanup: true}));
			const accounts = await repository.getAccountsConfig();
			expect(accounts.unclaimed_account_cleanup).toEqual({
				mode: CleanupModes.AFTER_INACTIVITY,
				inactive_days: 90,
				on_last_session_end: LastSessionCleanupModes.AFTER_GRACE,
			});
		});

		it('turns both cleanup policies off from a stored false', async () => {
			config.instance.selfHosted = true;
			const repository = createRepository();
			await repository.setConfig(ACCOUNTS_CONFIG_KEY, JSON.stringify({abandoned_account_cleanup: false}));
			const accounts = await repository.getAccountsConfig();
			expect(accounts.unclaimed_account_cleanup.mode).toBe(CleanupModes.OFF);
			expect(accounts.unclaimed_account_cleanup.on_last_session_end).toBe(LastSessionCleanupModes.OFF);
		});
	});

	it('reads an unknown guild join gate as always', async () => {
		const repository = createRepository();
		await repository.setConfig(ACCOUNTS_CONFIG_KEY, JSON.stringify({guild_join_gate: 'sometimes'}));
		const accounts = await repository.getAccountsConfig();
		expect(accounts.guild_join_gate).toBe(GuildJoinGates.ALWAYS);
		expect(accounts.interaction_tier).toBeDefined();
	});

	it('keeps the hosted accounts row exactly as it behaves today', async () => {
		config.instance.selfHosted = false;
		const repository = createRepository();
		await repository.setConfig(ACCOUNTS_CONFIG_KEY, JSON.stringify(LEGACY_HOSTED_ACCOUNTS));
		expect(await repository.getAccountsConfig()).toEqual({
			interaction_tier: 'legacy',
			guild_join_gate: GuildJoinGates.ALWAYS,
			unclaimed_account_cleanup: {
				mode: CleanupModes.OFF,
				inactive_days: 90,
				on_last_session_end: LastSessionCleanupModes.OFF,
			},
		});
	});
});
