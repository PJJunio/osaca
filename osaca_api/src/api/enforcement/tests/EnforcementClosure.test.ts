// SPDX-License-Identifier: AGPL-3.0-or-later

import {resolveDeletionDays} from '@app/api/admin/services/AdminUserDeletionService';
import {createTestAccount, loginAccount, type TestAccount} from '@app/api/auth/tests/AuthTestUtils';
import {getConfig} from '@app/api/Config';
import {createNoticeLookupDeps, loadAccountNotice} from '@app/api/enforcement/EnforcementAccountNotice';
import {
	close,
	closeRequest,
	createStaff,
	decisionBody,
	endDecision,
	getDecision,
	listDecisions,
	loadUser,
	suspend,
} from '@app/api/enforcement/tests/EnforcementTestUtils';
import {resetActivityEventsForTests, startActivityEvents} from '@app/api/infrastructure/activity/ActivityEvents';
import type {ActivityPublisher} from '@app/api/infrastructure/activity/ActivitySpool';
import type {Event} from '@app/api/infrastructure/activity/Contract.generated';
import {getUserRepository} from '@app/api/middleware/ServiceSingletons';
import {type ApiTestHarness, createApiTestHarness} from '@app/api/test/ApiTestHarness';
import {HTTP_STATUS} from '@app/api/test/TestConstants';
import {createBuilder} from '@app/api/test/TestRequestBuilder';
import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {DeletionReasons} from '@osaca/constants/src/Core';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {MockKVProvider} from '@pkgs/kv_client/src/testing/MockKVProvider';
import {ms} from 'itty-time';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test} from 'vitest';

class CapturingPublisher implements ActivityPublisher {
	readonly events: Array<Event> = [];

	async publish(_subject: string, payload: string): Promise<void> {
		this.events.push(JSON.parse(payload) as Event);
	}

	adminActions(targetId: string): Array<Extract<Event, {kind: 'admin_action'}>['data']> {
		return this.events
			.filter((event): event is Extract<Event, {kind: 'admin_action'}> => event.kind === 'admin_action')
			.filter((event) => event.data.target_id === targetId)
			.map((event) => event.data);
	}
}

function daysFromNow(iso: string | null): number {
	return Math.round((new Date(iso!).getTime() - Date.now()) / ms('1 day'));
}

describe('Enforcement closures', () => {
	let harness: ApiTestHarness;
	let staff: TestAccount;
	let publisher: CapturingPublisher;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		staff = await createStaff(harness);
		publisher = new CapturingPublisher();
		await startActivityEvents({publisher, kv: new MockKVProvider()});
	});

	afterEach(() => {
		resetActivityEventsForTests();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	describe('holder request', () => {
		test('signing in cancels it', async () => {
			const target = await createTestAccount(harness);
			await closeRequest(harness, staff, target.userId, {days_until_deletion: 14, basis: {type: 'holder_request'}})
				.expect(HTTP_STATUS.OK)
				.execute();
			await loginAccount(harness, target);
			const stored = await loadUser(target);
			expect(stored.pendingDeletionAt).toBeNull();
			expect(stored.flags & UserFlags.SELF_DELETED).toBe(0n);
		});

		test('remove_evidence is refused without a broken rule', async () => {
			const target = await createTestAccount(harness);
			const {json} = await closeRequest(harness, staff, target.userId, {
				days_until_deletion: 14,
				basis: {type: 'holder_request'},
				remove_evidence: true,
			})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.executeWithResponse();
			expect(JSON.stringify(json)).toContain(ValidationErrorCodes.ENFORCEMENT_EVIDENCE_REQUIRED);
			expect((await loadUser(target)).pendingDeletionAt).toBeNull();
		});
	});

	test('housekeeping writes code 19', async () => {
		const target = await createTestAccount(harness);
		await closeRequest(harness, staff, target.userId, {days_until_deletion: 30, basis: {type: 'housekeeping'}})
			.expect(HTTP_STATUS.OK)
			.execute();
		const stored = await loadUser(target);
		expect(stored.deletionReasonCode).toBe(DeletionReasons.INACTIVITY);
		expect(stored.flags & UserFlags.SELF_DELETED).toBe(UserFlags.SELF_DELETED);
		expect(publisher.adminActions(target.userId)[0]?.ips).toEqual([]);
	});

	test.each([
		['holder_request', 'holder_request'],
		['housekeeping', 'housekeeping'],
	])('a %s closure is refused while a decision owns the account', async (_label, type) => {
		const target = await createTestAccount(harness);
		const decisionId = await suspend(harness, staff, target.userId);
		const response = await closeRequest(harness, staff, target.userId, {days_until_deletion: 30, basis: {type}})
			.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.ENFORCEMENT_DECISION_OWNS_STATE)
			.execute();
		expect(response).toMatchObject({decision_id: decisionId});
		expect((await loadUser(target)).pendingDeletionAt).toBeNull();
	});

	describe('enforcement basis', () => {
		test('records a closure decision that lasts at least 74 days', async () => {
			const target = await createTestAccount(harness);
			const {user} = await closeRequest(harness, staff, target.userId, {
				days_until_deletion: 14,
				basis: {type: 'enforcement', decision: decisionBody()},
			})
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(daysFromNow(user.pending_deletion_at)).toBe(74);
			const stored = await loadUser(target);
			expect(stored.flags & UserFlags.DELETED).toBe(UserFlags.DELETED);
			expect(stored.flags & UserFlags.SELF_DELETED).toBe(0n);
			expect(stored.deletionReasonCode).toBe(DeletionReasons.SPAM);
			expect(stored.deletionPublicReason).toBeNull();
			expect(stored.deletionAuditLogReason).toBeNull();
			expect(stored.enforcementDecisionId?.toString()).toBe(user.enforcement_decision_id);
			const decision = await getDecision(harness, staff, user.enforcement_decision_id!);
			expect(decision).toMatchObject({kind: 'closure', status: 'active', notice_status: 'undelivered'});
			expect(decision.deletion_at).toBe(user.pending_deletion_at);
			expect(decision.notice_text).toContain(
				"We closed your account.\n\nYou can't sign in or use OSACA anywhere. We'll delete the account and its data on ",
			);
			expect(decision.notice_text).toContain('You may not create or use other accounts.');
			const [action] = publisher.adminActions(target.userId);
			expect(action).toMatchObject({action: 'schedule_deletion', reason_code: DeletionReasons.SPAM});
			expect(action?.ips.length).toBeGreaterThan(0);
		});

		test('a self-hosted instance has no appeal route, so a closure lasts at least 14 days', async () => {
			const config = getConfig();
			const selfHosted = config.instance.selfHosted;
			config.instance.selfHosted = true;
			try {
				const target = await createTestAccount(harness);
				const {user} = await closeRequest(harness, staff, target.userId, {
					days_until_deletion: 3,
					basis: {type: 'enforcement', decision: decisionBody()},
				})
					.expect(HTTP_STATUS.OK)
					.execute();
				expect(daysFromNow(user.pending_deletion_at)).toBe(14);
				const decision = await getDecision(harness, staff, user.enforcement_decision_id!);
				expect(decision).toMatchObject({kind: 'closure', status: 'active'});
				expect(decision.deletion_at).toBe(user.pending_deletion_at);
				expect((await loadUser(target)).flags & UserFlags.DELETED).toBe(UserFlags.DELETED);
			} finally {
				config.instance.selfHosted = selfHosted;
			}
		});

		test('each mode raises every basis to its own floor and keeps longer requests', () => {
			const config = getConfig();
			const selfHosted = config.instance.selfHosted;
			try {
				config.instance.selfHosted = false;
				expect(resolveDeletionDays('enforcement', 1)).toBe(74);
				expect(resolveDeletionDays('holder_request', 1)).toBe(14);
				expect(resolveDeletionDays('housekeeping', 1)).toBe(14);
				expect(resolveDeletionDays('enforcement', 90)).toBe(90);
				config.instance.selfHosted = true;
				expect(resolveDeletionDays('enforcement', 1)).toBe(14);
				expect(resolveDeletionDays('holder_request', 1)).toBe(14);
				expect(resolveDeletionDays('housekeeping', 1)).toBe(14);
				expect(resolveDeletionDays('enforcement', 90)).toBe(90);
			} finally {
				config.instance.selfHosted = selfHosted;
			}
		});

		test('a rule that does not bar new accounts sends no IPs', async () => {
			const target = await createTestAccount(harness);
			const decisionId = await close(
				harness,
				staff,
				target.userId,
				decisionBody({reason_code: DeletionReasons.UNDERAGE_ACCOUNT}),
			);
			expect(publisher.adminActions(target.userId)[0]?.ips).toEqual([]);
			const decision = await getDecision(harness, staff, decisionId);
			expect(decision.notice_text).toContain("you're welcome back once you're old enough");
			expect(decision.notice_text).not.toContain('You may not create or use other accounts.');
		});

		test('replaces a suspension and the suspension reads as replaced', async () => {
			const target = await createTestAccount(harness);
			const suspensionId = await suspend(harness, staff, target.userId);
			const closureId = await close(harness, staff, target.userId);
			const stored = await loadUser(target);
			expect(stored.enforcementDecisionId?.toString()).toBe(closureId);
			expect(stored.tempBannedUntil).toBeNull();
			expect(stored.flags & UserFlags.DISABLED).toBe(0n);
			const decisions = await listDecisions(harness, staff, target.userId);
			expect(decisions.find((decision) => decision.decision_id === suspensionId)?.replaced).toBe(true);
		});

		test('restricted reasons cannot close an account', async () => {
			const target = await createTestAccount(harness);
			await closeRequest(harness, staff, target.userId, {
				days_until_deletion: 74,
				basis: {type: 'enforcement', decision: decisionBody({reason_code: DeletionReasons.CHILD_SAFETY_VIOLATION})},
			})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
			expect((await loadUser(target)).pendingDeletionAt).toBeNull();
		});

		test('ending it is refused once the deletion has started', async () => {
			const target = await createTestAccount(harness);
			const decisionId = await close(harness, staff, target.userId);
			const users = getUserRepository();
			const user = await loadUser(target);
			const due = new Date(Date.now() - ms('1 minute'));
			await users.updateDeletionSchedule(user, {
				flags: user.flags,
				pending_deletion_at: due,
				deletion_reason_code: user.deletionReasonCode,
				deletion_scheduled_by: user.deletionScheduledBy,
				deletion_scheduled_at: user.deletionScheduledAt,
			});
			expect((await users.startDeletion(user.id, due))?.deletionStartedAt).not.toBeNull();
			await endDecision(harness, staff, decisionId)
				.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.ENFORCEMENT_DELETION_STARTED)
				.execute();
			expect((await getDecision(harness, staff, decisionId)).status).toBe('active');
		});

		test('the legacy cancel route refuses a closure a decision owns', async () => {
			const target = await createTestAccount(harness);
			const decisionId = await close(harness, staff, target.userId);
			const user = await loadUser(target);
			const response = await createBuilder<{decision_id: string}>(harness, staff.token)
				.delete(`/admin/users/${target.userId}/deletion`)
				.body({expected_pending_deletion_at: user.pendingDeletionAt!.toISOString()})
				.expect(HTTP_STATUS.CONFLICT, APIErrorCodes.ENFORCEMENT_DECISION_OWNS_STATE)
				.execute();
			expect(response.decision_id).toBe(decisionId);
			expect((await loadUser(target)).pendingDeletionAt).not.toBeNull();
		});
	});

	describe('closures from before decisions', () => {
		async function legacyClose(
			target: TestAccount,
			publicReason: string | null,
			reasonCode: number = DeletionReasons.HARASSMENT_OR_BULLYING,
		) {
			const users = getUserRepository();
			const user = await loadUser(target);
			return users.updateDeletionSchedule(user, {
				flags: user.flags | UserFlags.DELETED,
				pending_deletion_at: new Date(Date.now() + ms('60 days')),
				deletion_reason_code: reasonCode,
				deletion_public_reason: publicReason,
				deletion_scheduled_at: new Date(),
			});
		}

		test('the notice shows the stored public reason for a standard reason', async () => {
			const target = await createTestAccount(harness);
			const closed = await legacyClose(target, 'Sent the same invite to many people', DeletionReasons.SPAM);
			const notice = await loadAccountNotice(createNoticeLookupDeps(), closed, 'en-US');
			expect(notice).toMatchObject({
				decision_id: null,
				kind: 'closure',
				statement: 'Sent the same invite to many people',
				facts: [],
				rule: {title: 'Spam'},
			});
		});

		test.each([DeletionReasons.HARASSMENT_OR_BULLYING, DeletionReasons.CHILD_SEXUAL_CONTENT])(
			'the notice withholds the stored public reason for code %s',
			async (code) => {
				const target = await createTestAccount(harness);
				const closed = await legacyClose(target, 'Details about another person', code);
				const notice = await loadAccountNotice(createNoticeLookupDeps(), closed, 'en-US');
				expect(notice.statement).toBeNull();
				expect(notice.facts).toEqual(["We don't have more detail on record for this decision."]);
			},
		);
	});
});
