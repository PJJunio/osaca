// SPDX-License-Identifier: AGPL-3.0-or-later

import {Config} from '@app/api/Config';
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

function shouldEnforceAccountBudgets(request: Request | null): boolean {
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

async function readWindow(kv: IKVProvider, rule: Pick<WindowRule, 'key' | 'windowSeconds'>): Promise<number> {
	const raw = await kv.get(windowKey(rule));
	const value = raw === null ? 0 : Number.parseInt(raw, 10);
	return Number.isFinite(value) ? value : 0;
}

async function bumpWindow(kv: IKVProvider, rule: Pick<WindowRule, 'key' | 'windowSeconds'>): Promise<number> {
	const key = windowKey(rule);
	const count = await kv.incr(key);
	if (count === 1) await kv.expire(key, rule.windowSeconds + 60);
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

function instantIpRule(clientIp: string): WindowRule {
	return {key: `registration:instant:created:${ipKey(clientIp)}`, windowSeconds: HOUR, free: 0, doubling: true};
}

const INSTANT_GLOBAL_RULE = {key: 'registration:instant:global', windowSeconds: HOUR};

export async function instantAccountCaptchaSteps(
	env: BudgetEnv,
	params: {clientIp: string; escalationPerHour: number},
): Promise<number> {
	const createdFromIp = await readWindow(env.kv, instantIpRule(params.clientIp));
	const createdGlobally = await readWindow(env.kv, INSTANT_GLOBAL_RULE);
	return createdFromIp + Math.floor(createdGlobally / params.escalationPerHour);
}

export async function recordInstantAccountCreated(env: BudgetEnv, clientIp: string): Promise<void> {
	await bumpWindow(env.kv, instantIpRule(clientIp));
	await bumpWindow(env.kv, INSTANT_GLOBAL_RULE);
}
