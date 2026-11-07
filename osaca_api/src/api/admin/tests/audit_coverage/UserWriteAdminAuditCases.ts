// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
	AdminAuditCoverageCase,
	AdminAuditCoverageContext,
} from '@app/api/admin/tests/audit_coverage/AdminAuditCoverage';
import {
	createTestAccount,
	createUniqueUsername,
	setUserACLs,
	type TestAccount,
} from '@app/api/auth/tests/AuthTestUtils';
import {createUserID} from '@app/api/BrandedTypes';
import {getUserRepository} from '@app/api/middleware/ServiceSingletons';
import type {User} from '@app/api/models/User';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {AdminACLs} from '@osaca/constants/src/AdminACLs';
import {DeletionReasons} from '@osaca/constants/src/Core';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {expect} from 'vitest';

async function loadUser(account: TestAccount): Promise<User> {
	const user = await getUserRepository().findUnique(createUserID(BigInt(account.userId)));
	if (!user) {
		throw new Error(`User ${account.userId} not found`);
	}
	return user;
}

function adminBuilder({harness, admin}: AdminAuditCoverageContext) {
	return createBuilder(harness, admin.token);
}

const COVERAGE_DECISION = {
	reason_code: DeletionReasons.SPAM,
	source: 'own_review',
	automation: 'none',
	statement: 'Coverage decision',
};

export const UserWriteAdminAuditCases: ReadonlyArray<AdminAuditCoverageCase> = [
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/sessions',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users/${target.userId}/sessions`},
				expected: {
					action: 'terminate_sessions',
					targetType: 'user',
					targetId: target.userId,
					metadata: {},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/profile-fields',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {
					path: `/admin/users/${target.userId}/profile-fields`,
					body: {fields: ['bio', 'pronouns', 'global_name'], basis: {type: 'holder_request'}},
				},
				expected: {
					action: 'clear_fields',
					targetType: 'user',
					targetId: target.userId,
					metadata: {fields: 'bio,pronouns,global_name', basis: 'holder_request'},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/profile-fields',
		name: 'enforcement',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {
					path: `/admin/users/${target.userId}/profile-fields`,
					body: {fields: ['global_name'], basis: {type: 'enforcement', decision: COVERAGE_DECISION}},
				},
				expected: {
					action: 'clear_fields',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						fields: 'global_name',
						basis: 'enforcement',
						decision_id: expect.any(String),
						reason_code: DeletionReasons.SPAM.toString(),
						kind: 'profile_reset',
						notice_status: 'sent',
					},
				},
			};
		},
	},
	{
		method: 'PUT',
		route: '/admin/users/:user_id/bot-status',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users/${target.userId}/bot-status`, body: {bot: true}},
				expected: {
					action: 'set_bot_status',
					targetType: 'user',
					targetId: target.userId,
					metadata: {bot: 'true'},
				},
			};
		},
	},
	{
		method: 'PUT',
		route: '/admin/users/:user_id/system-status',
		async prepare(context) {
			const target = await createTestAccount(context.harness);
			await adminBuilder(context).put(`/admin/users/${target.userId}/bot-status`).body({bot: true}).execute();
			return {
				request: {path: `/admin/users/${target.userId}/system-status`, body: {system: true}},
				expected: {
					action: 'set_system_status',
					targetType: 'user',
					targetId: target.userId,
					metadata: {system: 'true'},
				},
			};
		},
	},
	{
		method: 'PATCH',
		route: '/admin/users/:user_id/username',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			const username = createUniqueUsername('renamed');
			return {
				request: {path: `/admin/users/${target.userId}/username`, body: {username}},
				expected: {
					action: 'change_username',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						old_username: (await loadUser(target)).username,
						new_username: username,
						discriminator: expect.any(String),
					},
				},
			};
		},
	},
	{
		method: 'POST',
		route: '/admin/users',
		async prepare() {
			const username = createUniqueUsername('created');
			return {
				request: {path: '/admin/users', body: {username}},
				expected: {
					action: 'create_user',
					targetType: 'user',
					targetId: expect.any(String),
					metadata: {username, admin: 'false'},
				},
			};
		},
	},
	{
		method: 'POST',
		route: '/admin/users/:user_id/sign-in-link',
		async prepare({harness}) {
			const target = await setUserACLs(harness, await createTestAccount(harness), [AdminACLs.WILDCARD]);
			return {
				request: {path: `/admin/users/${target.userId}/sign-in-link`, operator: true},
				expected: {
					action: 'create_sign_in_link',
					targetType: 'user',
					targetId: target.userId,
					metadata: {via: 'rexctl'},
				},
			};
		},
	},
	{
		method: 'PUT',
		route: '/admin/users/:user_id/ban',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {
					path: `/admin/users/${target.userId}/ban`,
					body: {duration_hours: 24, decision: COVERAGE_DECISION},
				},
				expected: {
					action: 'temp_ban',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						duration_hours: '24',
						banned_until: expect.any(String),
						decision_id: expect.any(String),
						reason_code: DeletionReasons.SPAM.toString(),
						kind: 'suspension',
						notice_status: 'undelivered',
					},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/ban',
		async prepare(context) {
			const target = await createTestAccount(context.harness);
			const users = getUserRepository();
			const user = await loadUser(target);
			await users.patchUpsert(user.id, {temp_banned_until: new Date(Date.now() + 86_400_000)}, user.toRow());
			await users.updateFlags(user.id, (flags) => flags | UserFlags.DISABLED);
			return {
				request: {path: `/admin/users/${target.userId}/ban`},
				expected: {
					action: 'unban',
					targetType: 'user',
					targetId: target.userId,
					metadata: {ended_notice: 'true'},
				},
			};
		},
	},
	{
		method: 'POST',
		route: '/admin/users/:user_id/warnings',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users/${target.userId}/warnings`, body: {decision: COVERAGE_DECISION}},
				expected: {
					action: 'warn_user',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						decision_id: expect.any(String),
						reason_code: DeletionReasons.SPAM.toString(),
						kind: 'warning',
						notice_status: 'sent',
					},
				},
			};
		},
	},
	{
		method: 'PUT',
		route: '/admin/users/:user_id/feature-limits',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {
					path: `/admin/users/${target.userId}/feature-limits`,
					body: {limit: 'direct_messages', decision: COVERAGE_DECISION},
				},
				expected: {
					action: 'limit_features',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						limit: 'direct_messages',
						decision_id: expect.any(String),
						reason_code: DeletionReasons.SPAM.toString(),
						kind: 'feature_limit',
						notice_status: 'sent',
					},
				},
			};
		},
	},
	{
		method: 'PUT',
		route: '/admin/users/:user_id/deletion',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {
					path: `/admin/users/${target.userId}/deletion`,
					body: {days_until_deletion: 30, basis: {type: 'holder_request'}},
				},
				expected: {
					action: 'schedule_deletion',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						basis: 'holder_request',
						days: '30',
						reason_code: DeletionReasons.USER_REQUESTED.toString(),
						pending_deletion_at: expect.any(String),
					},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/deletion',
		async prepare(context) {
			const target = await createTestAccount(context.harness);
			await adminBuilder(context)
				.put(`/admin/users/${target.userId}/deletion`)
				.body({days_until_deletion: 30, basis: {type: 'holder_request'}})
				.execute();
			const pendingDeletionAt = (await loadUser(target)).pendingDeletionAt!.toISOString();
			return {
				request: {
					path: `/admin/users/${target.userId}/deletion`,
					body: {expected_pending_deletion_at: pendingDeletionAt},
				},
				expected: {
					action: 'cancel_deletion',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						cancelled_pending_deletion_at: pendingDeletionAt,
						cancelled_scheduled_by: context.admin.userId,
						cancelled_scheduled_at: expect.any(String),
						cancelled_reason_code: DeletionReasons.USER_REQUESTED.toString(),
					},
				},
			};
		},
	},
	{
		method: 'DELETE',
		route: '/admin/users/:user_id/message-deletion',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			await createBuilder(harness, target.token)
				.post('/users/@me/messages/delete')
				.body({password: target.password})
				.expect(204)
				.execute();
			return {
				request: {path: `/admin/users/${target.userId}/message-deletion`},
				expected: {
					action: 'cancel_bulk_message_deletion',
					targetType: 'user',
					targetId: target.userId,
					metadata: {},
				},
			};
		},
	},
	{
		method: 'PUT',
		route: '/admin/users/:user_id/acls',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			const acls = [AdminACLs.AUTHENTICATE, AdminACLs.USER_LOOKUP];
			return {
				request: {path: `/admin/users/${target.userId}/acls`, body: {acls}},
				expected: {
					action: 'set_acls',
					targetType: 'user',
					targetId: target.userId,
					metadata: {acls: acls.join(',')},
				},
			};
		},
	},
	{
		method: 'PUT',
		route: '/admin/users/:user_id/traits',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			return {
				request: {path: `/admin/users/${target.userId}/traits`, body: {traits: ['coverage_trait']}},
				expected: {
					action: 'set_traits',
					targetType: 'user',
					targetId: target.userId,
					metadata: {traits: 'coverage_trait'},
				},
			};
		},
	},
	{
		method: 'PATCH',
		route: '/admin/users/:user_id/flags',
		async prepare({harness}) {
			const target = await createTestAccount(harness);
			const {flags} = await loadUser(target);
			return {
				request: {
					path: `/admin/users/${target.userId}/flags`,
					body: {add_flags: [UserFlags.PARTNER.toString()], remove_flags: [UserFlags.SPAMMER.toString()]},
				},
				expected: {
					action: 'update_flags',
					targetType: 'user',
					targetId: target.userId,
					metadata: {
						add_flags: UserFlags.PARTNER.toString(),
						remove_flags: UserFlags.SPAMMER.toString(),
						new_flags: ((flags | UserFlags.PARTNER) & ~UserFlags.SPAMMER).toString(),
					},
				},
			};
		},
	},
];
