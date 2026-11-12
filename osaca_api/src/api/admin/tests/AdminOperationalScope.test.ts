// SPDX-License-Identifier: AGPL-3.0-or-later

// ADR-0010: the Operator sees no IP addresses or locations and holds no ACL for the removed tools (issue #57).

import {createTestAccount, setUserACLs} from '@app/api/auth/tests/AuthTestUtils';
import {getInstanceConfigRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const IP_FIELDS = [
	'last_active_ip',
	'last_active_ip_reverse',
	'last_active_location',
	'client_ip',
	'client_ip_reverse',
	'client_location',
];

// message:lookup (reported evidence) and user:view:ip (network blocks) serve kept tools and stay.
const REMOVED_ACLS = [
	'archive:trigger:guild',
	'archive:trigger:user',
	'archive:view_all',
	'user:list:dm_channels',
	'user:list:relationships',
	'user:remove:relationship',
	'user:update:mfa',
	'user:create:password_reset_link',
	'user:delete:recovery_kit',
	'user:view:contact_log',
];

function ipFieldsIn(record: Record<string, unknown>): Array<string> {
	return IP_FIELDS.filter((field) => field in record);
}

describe('Admin API operational scope (ADR-0010)', () => {
	let harness: ApiTestHarness;
	beforeAll(async () => {
		harness = await createApiTestHarness({search: 'enabled'});
	});
	beforeEach(async () => {
		await harness.reset();
	});
	afterAll(async () => {
		await harness?.shutdown();
	});

	test('lists no ACL for a removed tool', async () => {
		const admin = await setUserACLs(harness, await createTestAccount(harness), [AdminACLs.AUTHENTICATE]);
		const {acls} = await createBuilder<{acls: Array<string>}>(harness, admin.token)
			.get('/admin/acls')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(acls.filter((acl) => REMOVED_ACLS.includes(acl))).toEqual([]);
	});

	test.each(REMOVED_ACLS)('refuses to grant the removed ACL %s', async (acl) => {
		const admin = await setUserACLs(harness, await createTestAccount(harness), [AdminACLs.WILDCARD]);
		const target = await createTestAccount(harness);
		await createBuilder(harness, admin.token)
			.put(`/admin/users/${target.userId}/acls`)
			.body({acls: [acl]})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('returns Accounts without an IP address, reverse DNS or location', async () => {
		const admin = await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.USER_LOOKUP,
		]);
		const target = await createTestAccount(harness);
		const result = await createBuilder<{users: Array<Record<string, unknown>>}>(harness, admin.token)
			.get(`/admin/users?resolve=${target.userId}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(result.users).toHaveLength(1);
		expect(ipFieldsIn(result.users[0]!)).toEqual([]);
	});

	test('does not narrow the user list by IP address', async () => {
		const admin = await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.USER_LOOKUP,
		]);
		// The acl selector ranked below last_active_ip, so an IP filter used to win and hide the target.
		const target = await setUserACLs(harness, await createTestAccount(harness), [AdminACLs.JOBS_VIEW]);
		const result = await createBuilder<{users: Array<{id: string}>}>(harness, admin.token)
			.get(`/admin/users?last_active_ip=203.0.113.9&acl=${AdminACLs.JOBS_VIEW}`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(result.users.map((user) => user.id)).toEqual([target.userId]);
	});

	test('lists sessions without an IP address, reverse DNS or location', async () => {
		const admin = await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.USER_LIST_SESSIONS,
		]);
		const target = await createTestAccount(harness);
		const result = await createBuilder<{sessions: Array<Record<string, unknown>>}>(harness, admin.token)
			.get(`/admin/users/${target.userId}/sessions`)
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(result.sessions.length).toBeGreaterThan(0);
		expect(result.sessions.flatMap(ipFieldsIn)).toEqual([]);
	});

	test('lists pending registrations without an IP address', async () => {
		const admin = await setUserACLs(harness, await createTestAccount(harness), [
			AdminACLs.AUTHENTICATE,
			AdminACLs.REGISTRATION_REVIEW,
		]);
		await getInstanceConfigRepository().setRegistrationConfig({mode: 'approval'});
		await createBuilderWithoutAuth(harness)
			.post('/auth/register')
			.body({username: `scope${Date.now()}`, password: 'operational-scope-1', consent: true})
			.execute();
		const listed = await createBuilder<{pending_registrations: Array<Record<string, unknown>>}>(harness, admin.token)
			.get('/admin/instance/pending-registrations')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(listed.pending_registrations.length).toBeGreaterThan(0);
		expect(listed.pending_registrations.flatMap(ipFieldsIn)).toEqual([]);
	});
});
