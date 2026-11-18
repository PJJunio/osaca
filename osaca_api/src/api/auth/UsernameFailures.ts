// SPDX-License-Identifier: AGPL-3.0-or-later

import {bumpWindow, readSlidingWindow, type WindowCounter} from '@app/api/auth/AccountBudgets';
import {parseLoginHandle} from '@app/api/user/UniqueUsernames';
import type {IKVProvider} from '@pkgs/kv_client/src/IKVProvider';

// Failures within the past hour against one username that each double the captcha cost of trying again (ADR-0017).
// Counted whether or not an Account has that username, so the count tells nothing about which usernames are taken.
export const UsernameFailureSteps = {
	login: {failuresPerStep: 10},
	recover: {failuresPerStep: 5},
} as const;

export type UsernameFailureKind = keyof typeof UsernameFailureSteps;

export function usernameKey(login: string): string | null {
	const handle = parseLoginHandle(login);
	return handle ? handle.username.toLowerCase() : null;
}

function failureCounter(kind: UsernameFailureKind, username: string): WindowCounter {
	return {key: `${kind}:failures:${username}`, windowSeconds: 3600};
}

export async function usernameFailureCaptchaSteps(
	kv: IKVProvider,
	kind: UsernameFailureKind,
	login: string,
): Promise<number> {
	const username = usernameKey(login);
	if (username === null) return 0;
	const failures = await readSlidingWindow(kv, failureCounter(kind, username));
	return Math.floor(failures / UsernameFailureSteps[kind].failuresPerStep);
}

export async function recordUsernameFailure(kv: IKVProvider, kind: UsernameFailureKind, login: string): Promise<void> {
	const username = usernameKey(login);
	if (username !== null) await bumpWindow(kv, failureCounter(kind, username));
}
