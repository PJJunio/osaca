// SPDX-License-Identifier: AGPL-3.0-or-later

import type {BudgetEnv} from '@app/api/auth/AccountBudgets';
import type {User} from '@app/api/models/User';
import {getAccountTier, isInteractionTierEnforced} from '@app/api/user/AccountTier';
import {createRateLimitError} from '@app/api/utils/RateLimitUtils';

const DAY_SECONDS = 86400;
const ACCOUNT_REPORTS_PER_DAY = 5;

type LimitedReportTargetType = 'message' | 'user' | 'guild';

export interface LimitedReportTarget {
	type: LimitedReportTargetType;
	id: bigint;
}

// One limited reporter's repeated reports on the same target count once (ADR-0017: keyed on the Account, not the address).
function dedupeKey(user: User, target: LimitedReportTarget): string {
	return `report:dedupe:user:${user.id}:${target.type}:${target.id}`;
}

export function isLimitedReporter(user: User): boolean {
	return isInteractionTierEnforced() && getAccountTier(user) !== 'verified';
}

export async function admitLimitedReport(
	env: BudgetEnv,
	params: {user: User; target: LimitedReportTarget},
): Promise<'store' | 'drop'> {
	const {user, target} = params;
	const result = await env.rateLimit.checkLimit({
		identifier: `report:limited:user:${user.id}`,
		maxAttempts: ACCOUNT_REPORTS_PER_DAY,
		windowMs: DAY_SECONDS * 1000,
	});
	if (!result.allowed && env.enforce) throw createRateLimitError(result);
	const stored = await env.kv.setnx(dedupeKey(user, target), '1', DAY_SECONDS);
	return stored ? 'store' : 'drop';
}
