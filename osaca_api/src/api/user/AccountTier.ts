// SPDX-License-Identifier: AGPL-3.0-or-later

import {RecoveryKitRepository} from '@app/api/auth/services/RecoveryKitRepository';
import type {UserID} from '@app/api/BrandedTypes';
import {getInteractionTierMode, guildJoinGateApplies} from '@app/api/instance/AccountsConfigCache';
import type {User} from '@app/api/models/User';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import {UserTraits} from '@app/api/user/UserTraits';
import {InteractionTierModes} from '@osaca/constants/src/AccountConfigConstants';
import {
	type AccountTier,
	AccountTiers,
	type AccountVerificationNeed,
	type LocalCredentialKind,
	LocalCredentialKinds,
	localCredentialKindOf,
	type TierExemption,
	TierExemptions,
	type TierGatedAction,
	TierGatedActions,
} from '@osaca/constants/src/AccountTierConstants';
import {
	evaluateTierGate,
	resolveAccountTier,
	resolveVerificationNeed,
	type TierGateDenial,
	type TierGateResult,
} from '@osaca/constants/src/AccountTierRules';
import {Headers} from '@osaca/constants/src/Headers';
import {UserAuthenticatorTypes} from '@osaca/constants/src/UserConstants';
import {AccountVerificationRequiredError} from '@osaca/errors/src/domains/auth/AccountVerificationRequiredError';
import type {OsacaError} from '@osaca/errors/src/OsacaError';
import type {Context} from 'hono';

export type {AccountTier};

export const GUILD_VISITS_CAPABILITY = 'guild_visits';

const KNOWN_CAPABILITIES = [GUILD_VISITS_CAPABILITY] as const;

export type TierCapability = (typeof KNOWN_CAPABILITIES)[number];

export interface TierContext {
	capabilities: ReadonlySet<TierCapability>;
	isGuildOwner?: boolean;
}

export const NO_TIER_CONTEXT: TierContext = {capabilities: new Set()};

type TierUser = Pick<User, 'isBot' | 'isSystem' | 'passwordHash' | 'authenticatorTypes'> & {
	traits: ReadonlySet<string>;
};

type GatedUser = TierUser & {id: UserID};

export function getLocalCredential(
	user: Pick<TierUser, 'passwordHash' | 'authenticatorTypes' | 'traits'>,
): LocalCredentialKind {
	return localCredentialKindOf({
		hasPassword: user.passwordHash !== null,
		hasPasskey: user.traits.has(UserTraits.PASSKEY) || user.authenticatorTypes.has(UserAuthenticatorTypes.WEBAUTHN),
	});
}

export function getAccountTier(user: TierUser): AccountTier {
	return resolveAccountTier({
		isBot: user.isBot,
		isSystem: user.isSystem,
		traits: user.traits,
		localCredential: getLocalCredential(user),
	});
}

export function getVerificationNeed(user: TierUser): AccountVerificationNeed | null {
	return resolveVerificationNeed(getAccountTier(user));
}

interface WayBackDeps {
	users: Pick<UserRepository, 'listWebAuthnCredentials'>;
}

const recoveryKits = new RecoveryKitRepository();

export async function hasWayBackIn(deps: WayBackDeps, user: GatedUser): Promise<boolean> {
	if (user.isBot || user.isSystem) return true;
	const localCredential = getLocalCredential(user);
	if (
		localCredential === LocalCredentialKinds.PASSKEY ||
		localCredential === LocalCredentialKinds.PASSWORD_AND_PASSKEY
	) {
		return true;
	}
	if (user.passwordHash !== null) return true;
	if ((await recoveryKits.find(user.id)) !== null) return true;
	return (await deps.users.listWebAuthnCredentials(user.id)).length > 0;
}

export function isInteractionTierEnforced(): boolean {
	return getInteractionTierMode() === InteractionTierModes.ENFORCED;
}

export function canReachOthers(user: TierUser): boolean {
	return getAccountTier(user) === AccountTiers.VERIFIED;
}

function tierExemptionsFor(ctx: TierContext): ReadonlyArray<TierExemption> {
	return ctx.isGuildOwner ? [TierExemptions.GUILD_OWNER] : [];
}

export function evaluateTierGateFor(user: GatedUser, action: TierGatedAction, ctx: TierContext): TierGateResult {
	const tier = getAccountTier(user);
	if (tier === AccountTiers.VERIFIED) return {allowed: true};
	return evaluateTierGate({
		tier,
		mode: getInteractionTierMode(),
		action,
		guildJoinGateApplies:
			action === TierGatedActions.GUILD_JOIN &&
			guildJoinGateApplies({userId: user.id, visitsCapable: ctx.capabilities.has(GUILD_VISITS_CAPABILITY)}),
		exemptions: tierExemptionsFor(ctx),
	});
}

export function canTierPerform(user: GatedUser, action: TierGatedAction, ctx: TierContext): boolean {
	return evaluateTierGateFor(user, action, ctx).allowed;
}

export function tierDenialError(denial: TierGateDenial): OsacaError {
	return new AccountVerificationRequiredError(denial.action, denial.tier, denial.need);
}

export function assertTierAllows(user: GatedUser, action: TierGatedAction, ctx: TierContext): void {
	const result = evaluateTierGateFor(user, action, ctx);
	if (!result.allowed) throw tierDenialError(result);
}

const MAX_CAPABILITY_HEADER_LENGTH = 512;

export function tierContextFrom(ctx: Context<HonoEnv>): TierContext {
	return tierContextFromRequest(ctx.req.raw);
}

export function tierContextFromRequest(request: Request): TierContext {
	return {capabilities: parseTierCapabilities(request.headers.get(Headers.X_OSACA_CAPABILITIES))};
}

export function parseTierCapabilities(headerValue: string | null | undefined): ReadonlySet<TierCapability> {
	if (!headerValue || headerValue.length > MAX_CAPABILITY_HEADER_LENGTH) return NO_TIER_CONTEXT.capabilities;
	const capabilities = new Set<TierCapability>();
	for (const raw of headerValue.split(',')) {
		const name = raw.trim().toLowerCase();
		const known = KNOWN_CAPABILITIES.find((capability) => capability === name);
		if (known) capabilities.add(known);
	}
	return capabilities;
}
