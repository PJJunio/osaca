// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AdminAuditLog} from '@app/api/admin/AdminRepository';
import type {TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {InstanceConfigWriteRaceExecutor} from '@app/api/instance/tests/InstanceConfigWriteRaceExecutor';
import {getAdminRepository, getInstanceConfigRepository} from '@app/api/middleware/ServiceSingletons';
import type {ApiTestHarness} from '@app/api/test/ApiTestHarness';
import {createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {InMemoryCassandraQueryExecutor} from '@app/api/test/InMemoryCassandraQueryExecutor';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import type {InstanceConfigResponse} from '@osaca/schema/src/domains/admin/AdminSchemas';
import {
	type DomainMigrationConfig,
	DomainMigrationConfigSchema,
} from '@osaca/schema/src/domains/admin/DomainMigrationSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const DOMAIN_MIGRATION_CONFIG_KEY = 'domain_migration_config';

describe('instance config admin PATCH under concurrent writes', () => {
	let harness: ApiTestHarness;
	let executor: InstanceConfigWriteRaceExecutor;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		executor = new InstanceConfigWriteRaceExecutor(new InMemoryCassandraQueryExecutor());
		setCassandraQueryExecutorForTesting(executor);
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness.shutdown();
	});

	const createAdmin = async (): Promise<TestAccount> =>
		await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.INSTANCE_CONFIG_VIEW,
			AdminACLs.INSTANCE_CONFIG_UPDATE,
		]);

	const patchConfig = (admin: TestAccount, body: Record<string, unknown>) =>
		createBuilder<InstanceConfigResponse>(harness, admin.token).patch('/admin/instance/config').body(body);

	async function readStoredDomainMigration(): Promise<DomainMigrationConfig> {
		const raw = await executor.readDirectly(DOMAIN_MIGRATION_CONFIG_KEY);
		if (raw === null) throw new Error('domain migration config was never stored');
		return JSON.parse(raw) as DomainMigrationConfig;
	}

	const domainMigrationAt = (configVersion: number): DomainMigrationConfig =>
		DomainMigrationConfigSchema.parse({config_version: configVersion});

	async function listConfigUpdateAudits(): Promise<Array<AdminAuditLog>> {
		const logs = await getAdminRepository().listAllAuditLogsPaginated(100000);
		return logs.filter((log) => log.action === 'update_instance_config');
	}

	it('merges a standalone forwarding patch into the stored domain migration config', async () => {
		const admin = await createAdmin();
		await patchConfig(admin, {domain_migration: {enabled: true, rollout_basis_points: 250}}).execute();

		const updated = await patchConfig(admin, {domain_migration: {standalone_forwarding: true}}).execute();

		expect(updated.domain_migration).toMatchObject({
			enabled: true,
			rollout_basis_points: 250,
			standalone_forwarding: true,
			config_version: 2,
		});
	});

	it('answers with a conflict and neither writes, publishes nor audits once every attempt has lost the race', async () => {
		const admin = await createAdmin();
		await executor.writeDirectly(DOMAIN_MIGRATION_CONFIG_KEY, JSON.stringify(domainMigrationAt(1)));
		getInstanceConfigRepository().clearCacheForTesting();
		const auditsBefore = await listConfigUpdateAudits();
		executor.watch(DOMAIN_MIGRATION_CONFIG_KEY);
		let competingWrites = 0;
		executor.competeBeforeEachWrite(async () => {
			competingWrites++;
			await executor.writeDirectly(
				DOMAIN_MIGRATION_CONFIG_KEY,
				JSON.stringify(domainMigrationAt(100 + competingWrites)),
			);
		});

		await patchConfig(admin, {domain_migration: {enabled: true}})
			.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.CONFLICT)
			.execute();

		expect(executor.events).not.toContain('write');
		expect(await readStoredDomainMigration()).toEqual(domainMigrationAt(100 + competingWrites));
		expect(await listConfigUpdateAudits()).toHaveLength(auditsBefore.length);
	});
});
