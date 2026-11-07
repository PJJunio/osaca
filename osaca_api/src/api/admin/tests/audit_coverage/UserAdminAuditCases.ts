// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AdminAuditCoverageCase} from '@app/api/admin/tests/audit_coverage/AdminAuditCoverage';
import {createTestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {createGuild} from '@app/api/channel/tests/ChannelTestUtils';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';

const MISSING_USER_ID = '999999999999999999';

export const UserAdminAuditCases: ReadonlyArray<AdminAuditCoverageCase> = [
	{
		method: 'GET',
		route: '/admin/acls',
		async prepare() {
			return {
				request: {path: '/admin/acls'},
				expected: {
					action: 'list_admin_acls',
					targetType: 'admin_acl',
					targetId: '0',
					metadata: {acl_count: String(Object.values(AdminACLs).length)},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users/@me',
		exempt: true,
		async prepare() {
			return {request: {path: '/admin/users/@me'}};
		},
	},
	{
		method: 'GET',
		route: '/admin/users',
		name: 'user_id',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users?user_id=${target.userId}`},
				expected: {
					action: 'search_users',
					targetType: 'user',
					targetId: '0',
					metadata: {
						selector: 'user_id',
						user_id: target.userId,
						user_id_count: '1',
						result_count: '1',
						total: '1',
					},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users',
		name: 'several user_id',
		async prepare({harness}) {
			const first = await createTestAccount(harness);
			const second = await createTestAccount(harness);
			return {
				request: {path: `/admin/users?user_id=${first.userId}&user_id=${second.userId}&user_id=${MISSING_USER_ID}`},
				expected: {
					action: 'search_users',
					targetType: 'user',
					targetId: '0',
					metadata: {
						selector: 'user_id',
						user_id_count: '3',
						result_count: '2',
						total: '2',
					},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users',
		name: 'resolve',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users?resolve=${encodeURIComponent(target.username)}`},
				expected: {
					action: 'search_users',
					targetType: 'user',
					targetId: '0',
					metadata: {
						selector: 'resolve',
						result_count: '1',
						total: '1',
					},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users',
		name: 'acl',
		async prepare() {
			return {
				request: {path: `/admin/users?acl=${encodeURIComponent(AdminACLs.WILDCARD)}&limit=10&offset=0`},
				expected: {
					action: 'search_users',
					targetType: 'user',
					targetId: '0',
					metadata: {
						selector: 'acl',
						acl: AdminACLs.WILDCARD,
						limit: '10',
						offset: '0',
						result_count: '1',
						total: '1',
					},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users',
		name: 'search',
		search: 'enabled',
		async prepare() {
			return {
				request: {path: '/admin/users?q=nobody-matches-this-query&limit=25'},
				expected: {
					action: 'search_users',
					targetType: 'user',
					targetId: '0',
					metadata: {
						selector: 'search',
						has_query: 'true',
						limit: '25',
						offset: '0',
						result_count: '0',
						total: '0',
					},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users/:user_id',
		name: 'found',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users/${target.userId}`},
				expected: {
					action: 'get_user',
					targetType: 'user',
					targetId: target.userId,
					metadata: {found: 'true'},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users/:user_id',
		name: 'missing',
		async prepare() {
			return {
				request: {path: `/admin/users/${MISSING_USER_ID}`},
				expected: {
					action: 'get_user',
					targetType: 'user',
					targetId: MISSING_USER_ID,
					metadata: {found: 'false'},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users/:user_id/guilds',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			await createGuild(harness, target.token, 'Audit Guild One');
			const second = await createGuild(harness, target.token, 'Audit Guild Two');
			return {
				request: {path: `/admin/users/${target.userId}/guilds?before=${second.id}&limit=50`},
				expected: {
					action: 'list_user_guilds',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						before_guild_id: second.id,
						limit: '50',
						with_counts: 'false',
						guild_count: '1',
					},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/users/:user_id/sessions',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users/${target.userId}/sessions`},
				expected: {
					action: 'list_user_sessions',
					targetType: 'user',
					targetId: target.userId,
					metadata: {session_count: '1'},
				},
			};
		},
	},
	{
		method: 'GET',
		route: '/admin/app-sessions',
		async prepare() {
			return {
				request: {path: '/admin/app-sessions?platform=ios&release_channel=beta'},
				expected: {
					action: 'list_app_sessions',
					targetType: 'user',
					targetId: '0',
					metadata: {platform: 'ios', release_channel: 'beta', has_cursor: 'false', result_count: '0'},
				},
			};
		},
	},
];
