// SPDX-License-Identifier: AGPL-3.0-or-later

import {bumpWindow, readSlidingWindow, type WindowCounter} from '@app/api/auth/AccountBudgets';
import type {IKVProvider} from '@pkgs/kv_client/src/IKVProvider';

// Solved challenges per minute, across the whole Instance, that each double the captcha cost on a route without a
// session (ADR-0017). Only solved challenges count, so raising the cost for everyone costs the attacker proof-of-work
// too. Never keyed on the client address.
export const CaptchaPressure = {
	login: {solvesPerMinute: 120},
	recover: {solvesPerMinute: 30},
	register: {solvesPerMinute: 30},
} as const;

export type CaptchaPressureAction = keyof typeof CaptchaPressure;

function pressureCounter(action: CaptchaPressureAction): WindowCounter {
	return {key: `captcha:pressure:${action}`, windowSeconds: 60};
}

export async function captchaPressureSteps(kv: IKVProvider, action: CaptchaPressureAction): Promise<number> {
	const solves = await readSlidingWindow(kv, pressureCounter(action));
	return Math.floor(solves / CaptchaPressure[action].solvesPerMinute);
}

export async function recordCaptchaSolve(kv: IKVProvider, action: CaptchaPressureAction): Promise<void> {
	await bumpWindow(kv, pressureCounter(action));
}
