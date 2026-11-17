// SPDX-License-Identifier: AGPL-3.0-or-later

import {sha256Hex} from '@app/api/auth/AccountCodes';
import {Config} from '@app/api/Config';
import {parseInviteCodeList} from '@app/api/instance/AutoJoinInviteCodes';
import {createRateLimitError} from '@app/api/utils/RateLimitUtils';
import {getSameIpDecisionKey, getSubnet} from '@osaca/ip_utils/src/IpAddress';
import type {IKVProvider} from '@pkgs/kv_client/src/IKVProvider';
import type {IRateLimitService} from '@pkgs/rate_limit/src/IRateLimitService';

const TEST_ENABLE_RATE_LIMITS_HEADER = 'x-osaca-test-enable-rate-limits';

export interface BudgetEnv {
	kv: IKVProvider;
	rateLimit: IRateLimitService;
	enforce: boolean;
}

export function shouldEnforceAccountBudgets(request: Request | null): boolean {
	if (!Config.dev.testModeEnabled) return !Config.dev.disableRateLimits;
	return request?.headers.get(TEST_ENABLE_RATE_LIMITS_HEADER) === 'true';
}

export function budgetEnvFor(
	services: {kv: IKVProvider; rateLimit: IRateLimitService},
	request: Request | null,
): BudgetEnv {
	return {kv: services.kv, rateLimit: services.rateLimit, enforce: shouldEnforceAccountBudgets(request)};
}

export function ipKey(clientIp: string): string {
	return getSameIpDecisionKey(clientIp) ?? clientIp;
}

interface WindowRule {
	key: string;
	windowSeconds: number;
	free: number;
	doubling: boolean;
}

function windowKey(rule: Pick<WindowRule, 'key' | 'windowSeconds'>, nowMs = Date.now()): string {
	return `${rule.key}:${Math.floor(nowMs / 1000 / rule.windowSeconds)}`;
}

export type WindowCounter = Pick<WindowRule, 'key' | 'windowSeconds'>;

// The count over the last full window, weighting the previous bucket by how much of it still falls inside, so the
// count fades instead of dropping to zero at a bucket edge.
export async function readSlidingWindow(kv: IKVProvider, rule: WindowCounter, nowMs = Date.now()): Promise<number> {
	const windowMs = rule.windowSeconds * 1000;
	const elapsed = (nowMs % windowMs) / windowMs;
	const current = await readWindowAt(kv, rule, nowMs);
	const previous = await readWindowAt(kv, rule, nowMs - windowMs);
	return current + previous * (1 - elapsed);
}

async function readWindowAt(kv: IKVProvider, rule: WindowCounter, nowMs: number): Promise<number> {
	const raw = await kv.get(windowKey(rule, nowMs));
	const value = raw === null ? 0 : Number.parseInt(raw, 10);
	return Number.isFinite(value) ? value : 0;
}

export async function bumpWindow(kv: IKVProvider, rule: WindowCounter): Promise<number> {
	const key = windowKey(rule);
	const count = await kv.incr(key);
	// Kept through the next window too, which readSlidingWindow still reads.
	if (count === 1) await kv.expire(key, rule.windowSeconds * 2 + 60);
	return count;
}

async function enforceHardLimit(
	env: BudgetEnv,
	identifier: string,
	maxAttempts: number,
	windowSeconds: number,
): Promise<void> {
	const result = await env.rateLimit.checkLimit({identifier, maxAttempts, windowMs: windowSeconds * 1000});
	if (!result.allowed && env.enforce) throw createRateLimitError(result);
}

export type RequesterClass = 'known' | 'unknown';

export function requesterNetworkKey(clientIp: string): string {
	return getSubnet(clientIp) ?? ipKey(clientIp);
}

const HOUR = 3600;
const DAY = 86400;

export async function enforceInstantAccountLimits(env: BudgetEnv, clientIp: string): Promise<void> {
	const key = ipKey(clientIp);
	await enforceHardLimit(env, `registration:instant:ip:${key}:hour`, 5, HOUR);
	await enforceHardLimit(env, `registration:instant:ip:${key}:day`, 20, DAY);
	const subnet = getSubnet(clientIp);
	if (subnet) await enforceHardLimit(env, `registration:instant:subnet:${subnet}`, 40, HOUR);
}

const INSTANT_GLOBAL_RULE: WindowCounter = {key: 'registration:instant:global', windowSeconds: HOUR};

export async function instantAccountCaptchaSteps(env: BudgetEnv, params: {escalationPerHour: number}): Promise<number> {
	const createdGlobally = await readSlidingWindow(env.kv, INSTANT_GLOBAL_RULE);
	return Math.floor(createdGlobally / params.escalationPerHour);
}

export async function recordInstantAccountCreated(env: BudgetEnv): Promise<void> {
	await bumpWindow(env.kv, INSTANT_GLOBAL_RULE);
}

// Accounts one invite or registration URL code may create in an hour, Instance-wide (ADR-0017). A leaked code then
// cannot mint accounts faster than this, whoever uses it. A registration URL counts as its own code, not as the invite
// it carries. Codes are hashed in the key.
export const SIGN_UPS_PER_CODE_PER_HOUR = 30;

export interface SignUpCodes {
	registrationUrlCode: string | null;
	inviteCode: string | null;
}

function signUpCodeCounters(codes: SignUpCodes): Array<WindowCounter> {
	const counters: Array<WindowCounter> = [];
	const registrationUrlCode = codes.registrationUrlCode?.trim();
	if (registrationUrlCode) {
		counters.push({key: `registration:code:registration_url:${sha256Hex(registrationUrlCode)}`, windowSeconds: HOUR});
	}
	for (const inviteCode of parseInviteCodeList(codes.inviteCode)) {
		counters.push({key: `registration:code:invite:${sha256Hex(inviteCode)}`, windowSeconds: HOUR});
	}
	return counters;
}

export async function assertSignUpCodeBudget(env: BudgetEnv, codes: SignUpCodes): Promise<void> {
	if (!env.enforce) return;
	for (const counter of signUpCodeCounters(codes)) {
		if ((await readSlidingWindow(env.kv, counter)) < SIGN_UPS_PER_CODE_PER_HOUR) continue;
		throw createRateLimitError({
			allowed: false,
			limit: SIGN_UPS_PER_CODE_PER_HOUR,
			remaining: 0,
			resetTime: new Date(Date.now() + (HOUR * 1000) / SIGN_UPS_PER_CODE_PER_HOUR),
			resetAfterDecimal: HOUR / SIGN_UPS_PER_CODE_PER_HOUR,
		});
	}
}

export async function recordSignUpThroughCodes(env: BudgetEnv, codes: SignUpCodes): Promise<void> {
	for (const counter of signUpCodeCounters(codes)) await bumpWindow(env.kv, counter);
}
