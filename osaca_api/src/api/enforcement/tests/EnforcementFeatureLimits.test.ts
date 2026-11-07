// SPDX-License-Identifier: AGPL-3.0-or-later

import {createTestAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {upsertOne} from '@app/api/database/CassandraQueryExecution';
import {Db} from '@app/api/database/CassandraTypes';
import {
	createStaff,
	decisionBody,
	endDecision,
	getDecision,
	INTERNAL_NOTE,
	limitFeatures,
	limitRequest,
	loadUser,
	suspend,
} from '@app/api/enforcement/tests/EnforcementTestUtils';
import {getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {EnforcementDecisions} from '@app/api/Tables';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {DeletionReasons} from '@osaca/constants/src/Core';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {ms} from 'itty-time';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const REPORT_ABUSE = decisionBody({
	reason_code: DeletionReasons.REPORTING_ABUSE,
	statement: 'You sent many reports about the same person that were not true.',
});

describe('Enforcement feature limits', () => {
	let harness: ApiTestHarness;
	let staff: TestAccount;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		staff = await createStaff(harness);
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	function reportUser(reporter: TestAccount, target: TestAccount) {
		return createBuilder<{report_id: string}>(harness, reporter.token)
			.post('/reports/user')
			.body({user_id: target.userId, category: 'harassment'});
	}

	async function expireDecision(decisionId: string) {
		await upsertOne(
			EnforcementDecisions.patchByPk(
				{decision_id: BigInt(decisionId)},
				{ends_at: Db.set(new Date(Date.now() - ms('1 hour')))},
			),
		);
	}

	function patchFlags(target: TestAccount, body: Record<string, Array<string>>) {
		return createBuilder<{decision_id?: string}>(harness, staff.token)
			.patch(`/admin/users/${target.userId}/flags`)
			.body(body);
	}

	test.each([
		['harassment', DeletionReasons.HARASSMENT_OR_BULLYING, ValidationErrorCodes.ENFORCEMENT_KIND_NOT_ALLOWED],
		['misuse of reporting', DeletionReasons.REPORTING_ABUSE, ValidationErrorCodes.ENFORCEMENT_LIMIT_NOT_ALLOWED],
	])('a direct message limit is refused for %s', async (_label, reasonCode, errorCode) => {
		const target = await createTestAccount(harness);
		const {json} = await limitRequest(harness, staff, target.userId, {
			limit: 'direct_messages',
			decision: decisionBody({reason_code: reasonCode}),
		})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.executeWithResponse();
		expect(JSON.stringify(json)).toContain(errorCode);
		expect((await loadUser(target)).flags & UserFlags.SPAMMER).toBe(0n);
	});

	describe('reports', () => {
		test('ends after 90 days by default and refuses an end beyond 365 days', async () => {
			const target = await createTestAccount(harness);
			const decisionId = await limitFeatures(harness, staff, target.userId, 'reports', REPORT_ABUSE);
			const decision = await getDecision(harness, staff, decisionId);
			expect(Math.round((new Date(decision.ends_at!).getTime() - Date.now()) / ms('1 day'))).toBe(90);
			expect(decision.notice_text).toContain('use the safety route on our [company information page]');
			const {json} = await limitRequest(harness, staff, target.userId, {
				limit: 'reports',
				ends_at: new Date(Date.now() + ms('400 days')).toISOString(),
				decision: REPORT_ABUSE,
			})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.executeWithResponse();
			expect(JSON.stringify(json)).toContain(ValidationErrorCodes.ENFORCEMENT_LIMIT_END_INVALID);
		});

		test('an end date is refused for other limits', async () => {
			const target = await createTestAccount(harness);
			const {json} = await limitRequest(harness, staff, target.userId, {
				limit: 'direct_messages',
				ends_at: new Date(Date.now() + ms('30 days')).toISOString(),
				decision: decisionBody({reason_code: DeletionReasons.SPAM}),
			})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.executeWithResponse();
			expect(JSON.stringify(json)).toContain(ValidationErrorCodes.ENFORCEMENT_LIMIT_END_INVALID);
		});

		test('refuses reports while active and expires lazily at the next report', async () => {
			const reporter = await createTestAccount(harness);
			const reported = await createTestAccount(harness);
			const decisionId = await limitFeatures(harness, staff, reporter.userId, 'reports', REPORT_ABUSE);
			await reportUser(reporter, reported).expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.REPORT_BANNED).execute();
			await expireDecision(decisionId);
			expect((await getDecision(harness, staff, decisionId)).expired).toBe(true);
			await reportUser(reporter, reported).expect(HTTP_STATUS.OK).execute();
			expect((await loadUser(reporter)).flags & UserFlags.REPORT_BANNED).toBe(0n);
		});

		test('a flag set before decisions existed keeps refusing reports', async () => {
			const reporter = await createTestAccount(harness);
			const reported = await createTestAccount(harness);
			await getUserRepository().updateFlags((await loadUser(reporter)).id, (flags) => flags | UserFlags.REPORT_BANNED);
			await reportUser(reporter, reported).expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.REPORT_BANNED).execute();
		});
	});

	test('ending one limit keeps the flag while another decision holds the same limit', async () => {
		const target = await createTestAccount(harness);
		const first = await limitFeatures(harness, staff, target.userId, 'direct_messages');
		const second = await limitFeatures(
			harness,
			staff,
			target.userId,
			'direct_messages',
			decisionBody({reason_code: DeletionReasons.MALICIOUS_LINKS_OR_MALWARE}),
		);
		await endDecision(harness, staff, first).expect(HTTP_STATUS.OK).execute();
		expect((await loadUser(target)).flags & UserFlags.SPAMMER).toBe(UserFlags.SPAMMER);
		await endDecision(harness, staff, second).expect(HTTP_STATUS.OK).execute();
		expect((await loadUser(target)).flags & UserFlags.SPAMMER).toBe(0n);
	});

	describe('flag route guards', () => {
		test.each([
			['DISABLED', UserFlags.DISABLED],
			['DELETED', UserFlags.DELETED],
			['SPAMMER', UserFlags.SPAMMER],
			['REPORT_BANNED', UserFlags.REPORT_BANNED],
		])('adding %s is refused', async (_label, flag) => {
			const target = await createTestAccount(harness);
			await patchFlags(target, {add_flags: [flag.toString()]})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
			expect((await loadUser(target)).flags & flag).toBe(0n);
		});

		test('removing a flag a decision holds is refused with the decision', async () => {
			const target = await createTestAccount(harness);
			const spam = await limitFeatures(harness, staff, target.userId, 'direct_messages');
			const spamResponse = await patchFlags(target, {remove_flags: [UserFlags.SPAMMER.toString()]})
				.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.ENFORCEMENT_DECISION_OWNS_STATE)
				.execute();
			expect(spamResponse.decision_id).toBe(spam);
		});

		test('removing DISABLED from a suspended account and removing DELETED are refused', async () => {
			const target = await createTestAccount(harness);
			await suspend(harness, staff, target.userId);
			await patchFlags(target, {remove_flags: [UserFlags.DISABLED.toString()]})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
			const other = await createTestAccount(harness);
			await getUserRepository().updateFlags((await loadUser(other)).id, (flags) => flags | UserFlags.DELETED);
			await patchFlags(other, {remove_flags: [UserFlags.DELETED.toString()]})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('a self-disabled account can still have DISABLED removed', async () => {
			const target = await createTestAccount(harness);
			await getUserRepository().updateFlags((await loadUser(target)).id, (flags) => flags | UserFlags.DISABLED);
			await patchFlags(target, {remove_flags: [UserFlags.DISABLED.toString()]})
				.expect(HTTP_STATUS.OK)
				.execute();
			expect((await loadUser(target)).flags & UserFlags.DISABLED).toBe(0n);
		});

		test('a bulk flag job cannot add a restriction flag', async () => {
			const target = await createTestAccount(harness);
			await createBuilder(harness, staff.token)
				.post('/admin/bulk-jobs')
				.header('X-Audit-Log-Reason', INTERNAL_NOTE)
				.body({
					task: 'update_user_flags',
					user_ids: [target.userId],
					add_flags: [UserFlags.SPAMMER.toString()],
					remove_flags: [],
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});
	});
});
