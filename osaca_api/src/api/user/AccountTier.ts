// SPDX-License-Identifier: AGPL-3.0-or-later

import {RecoveryKitRepository} from '@app/api/auth/services/RecoveryKitRepository';
import type {UserID} from '@app/api/BrandedTypes';
import {getCachedAccountIdentityMode, usesUsernameSignIn} from '@app/api/instance/AccountIdentityModeCache';
import {
	getEffectiveVerificationBasis,
	getEmailDeliveryState,
	getInteractionTierMode,
	guildJoinGateApplies,
} from '@app/api/instance/AccountsConfigCache';
import type {User} from '@app/api/models/User';
import type {HonoEnv} from '@app/api/types/HonoEnv';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import {UserTraits} from '@app/api/user/UserTraits';
import {EmailDeliveryStates, InteractionTierModes} from '@osaca/constants/src/AccountConfigConstants';
import {
	type AccountTier,
	AccountTiers,
	type AccountVerificationNeed,
	AccountVerificationNeeds,
	type LocalCredentialKind,
	LocalCredentialKinds,
	localCredentialKindOf,
	type PurchaseBlockedReason,
	type TierDenialError,
	TierDenialErrors,
	type TierExemption,
	TierExemptions,
	type TierGatedAction,
	TierGatedActions,
} from '@osaca/constants/src/AccountTierConstants';
import {
	evaluateTierGate,
	resolveAccountTier,
	resolvePurchaseBlockedReason,
	resolveVerificationNeed,
	type TierGateDenial,
	type TierGateResult,
} from '@osaca/constants/src/AccountTierRules';
import {Headers} from '@osaca/constants/src/Headers';
import {UserAuthenticatorTypes} from '@osaca/constants/src/UserConstants';
import {AccountVerificationRequiredError} from '@osaca/errors/src/domains/auth/AccountVerificationRequiredError';
import {
	DirectMessageEmailVerificationRequiredError,
	EmailVerificationRequiredError,
	FriendRequestEmailVerificationRequiredError,
	GuildCreationEmailVerificationRequiredError,
	GuildEmailVerificationRequiredError,
	MfaEmailVerificationRequiredError,
	ProfileEmailVerificationRequiredError,
	ReactionEmailVerificationRequiredError,
	ReportEmailVerificationRequiredError,
} from '@osaca/errors/src/domains/auth/EmailVerificationRequiredError';
import {UnclaimedAccountCannotAddReactionsError} from '@osaca/errors/src/domains/channel/UnclaimedAccountCannotAddReactionsError';
import {UnclaimedAccountCannotJoinGroupDmsError} from '@osaca/errors/src/domains/channel/UnclaimedAccountCannotJoinGroupDmsError';
import {UnclaimedAccountCannotJoinOneOnOneVoiceCallsError} from '@osaca/errors/src/domains/channel/UnclaimedAccountCannotJoinOneOnOneVoiceCallsError';
import {UnclaimedAccountCannotJoinVoiceChannelsError} from '@osaca/errors/src/domains/channel/UnclaimedAccountCannotJoinVoiceChannelsError';
import {UnclaimedAccountCannotSendDirectMessagesError} from '@osaca/errors/src/domains/channel/UnclaimedAccountCannotSendDirectMessagesError';
import {UnclaimedAccountCannotSendMessagesError} from '@osaca/errors/src/domains/channel/UnclaimedAccountCannotSendMessagesError';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import {GuildVerificationRequiredError} from '@osaca/errors/src/domains/guild/GuildVerificationRequiredError';
import {UnclaimedAccountCannotCreateGuildsError} from '@osaca/errors/src/domains/guild/UnclaimedAccountCannotCreateGuildsError';
import {UnclaimedAccountCannotSubmitReportsError} from '@osaca/errors/src/domains/moderation/UnclaimedAccountCannotSubmitReportsError';
import {UnclaimedAccountCannotCreateApplicationsError} from '@osaca/errors/src/domains/oauth/UnclaimedAccountCannotCreateApplicationsError';
import {UnclaimedAccountCannotAcceptFriendRequestsError} from '@osaca/errors/src/domains/user/UnclaimedAccountCannotAcceptFriendRequestsError';
import {UnclaimedAccountCannotSendFriendRequestsError} from '@osaca/errors/src/domains/user/UnclaimedAccountCannotSendFriendRequestsError';
import type {OsacaError} from '@osaca/errors/src/OsacaError';
import type {Context} from 'hono';

export type {AccountTier};

export const GUILD_VISITS_CAPABILITY = 'guild_visits';
export const PAYMENT_DISPUTE_REASON_CAPABILITY = 'payment_dispute_reason';

const KNOWN_CAPABILITIES = [GUILD_VISITS_CAPABILITY, PAYMENT_DISPUTE_REASON_CAPABILITY] as const;

export type TierCapability = (typeof KNOWN_CAPABILITIES)[number];

export interface TierContext {
	capabilities: ReadonlySet<TierCapability>;
	isGuildOwner?: boolean;
}

export const NO_TIER_CONTEXT: TierContext = {capabilities: new Set()};

type TierUser = Pick<User, 'isBot' | 'isSystem' | 'email' | 'emailVerified' | 'passwordHash' | 'authenticatorTypes'> & {
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
		identityMode: getCachedAccountIdentityMode(),
		effectiveBasis: getEffectiveVerificationBasis(),
		hasEmail: user.email !== null,
		emailVerified: user.emailVerified,
		localCredential: getLocalCredential(user),
	});
}

export function getVerificationNeed(user: TierUser): AccountVerificationNeed | null {
	return resolveVerificationNeed({
		tier: getAccountTier(user),
		identityMode: getCachedAccountIdentityMode(),
		hasEmail: user.email !== null,
	});
}

interface WayBackDeps {
	users: Pick<UserRepository, 'listWebAuthnCredentials'>;
}

const recoveryKits = new RecoveryKitRepository();

export async function hasWayBackIn(deps: WayBackDeps, user: GatedUser): Promise<boolean> {
	if (user.isBot || user.isSystem || user.traits.has(UserTraits.SSO)) return true;
	const localCredential = getLocalCredential(user);
	if (
		localCredential === LocalCredentialKinds.PASSKEY ||
		localCredential === LocalCredentialKinds.PASSWORD_AND_PASSKEY
	) {
		return true;
	}
	const usernameMode = usesUsernameSignIn();
	if (user.passwordHash !== null && (usernameMode || user.email !== null)) return true;
	if (user.email !== null && !usernameMode && getEmailDeliveryState() === EmailDeliveryStates.ON) return true;
	if (usernameMode && (await recoveryKits.find(user.id)) !== null) return true;
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
		identityMode: getCachedAccountIdentityMode(),
		hasEmail: user.email !== null,
		guildJoinGateApplies:
			action === TierGatedActions.GUILD_JOIN &&
			guildJoinGateApplies({userId: user.id, visitsCapable: ctx.capabilities.has(GUILD_VISITS_CAPABILITY)}),
		exemptions: tierExemptionsFor(ctx),
	});
}

export function canTierPerform(user: GatedUser, action: TierGatedAction, ctx: TierContext): boolean {
	return evaluateTierGateFor(user, action, ctx).allowed;
}

const TIER_DENIAL_ERRORS: Record<TierDenialError, (denial: TierGateDenial) => OsacaError> = {
	[TierDenialErrors.ACCOUNT_VERIFICATION_REQUIRED]: (denial) =>
		new AccountVerificationRequiredError(denial.action, denial.tier, denial.need),
	[TierDenialErrors.EMAIL_VERIFICATION_REQUIRED]: () => new EmailVerificationRequiredError(),
	[TierDenialErrors.DIRECT_MESSAGE_EMAIL_VERIFICATION_REQUIRED]: () =>
		new DirectMessageEmailVerificationRequiredError(),
	[TierDenialErrors.FRIEND_REQUEST_EMAIL_VERIFICATION_REQUIRED]: () =>
		new FriendRequestEmailVerificationRequiredError(),
	[TierDenialErrors.GUILD_CREATION_EMAIL_VERIFICATION_REQUIRED]: () =>
		new GuildCreationEmailVerificationRequiredError(),
	[TierDenialErrors.GUILD_EMAIL_VERIFICATION_REQUIRED]: () => new GuildEmailVerificationRequiredError(),
	[TierDenialErrors.GUILD_VERIFICATION_REQUIRED]: () => new GuildVerificationRequiredError(),
	[TierDenialErrors.MFA_EMAIL_VERIFICATION_REQUIRED]: () => new MfaEmailVerificationRequiredError(),
	[TierDenialErrors.PROFILE_EMAIL_VERIFICATION_REQUIRED]: () => new ProfileEmailVerificationRequiredError(),
	[TierDenialErrors.REACTION_EMAIL_VERIFICATION_REQUIRED]: () => new ReactionEmailVerificationRequiredError(),
	[TierDenialErrors.REPORT_EMAIL_VERIFICATION_REQUIRED]: () => new ReportEmailVerificationRequiredError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_ACCEPT_FRIEND_REQUESTS]: () =>
		new UnclaimedAccountCannotAcceptFriendRequestsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_ADD_REACTIONS]: () => new UnclaimedAccountCannotAddReactionsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_CREATE_APPLICATIONS]: () =>
		new UnclaimedAccountCannotCreateApplicationsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_CREATE_GUILDS]: () => new UnclaimedAccountCannotCreateGuildsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_JOIN_GROUP_DMS]: () => new UnclaimedAccountCannotJoinGroupDmsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_JOIN_ONE_ON_ONE_VOICE_CALLS]: () =>
		new UnclaimedAccountCannotJoinOneOnOneVoiceCallsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_JOIN_VOICE_CHANNELS]: () =>
		new UnclaimedAccountCannotJoinVoiceChannelsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_SEND_DIRECT_MESSAGES]: () =>
		new UnclaimedAccountCannotSendDirectMessagesError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_SEND_FRIEND_REQUESTS]: () =>
		new UnclaimedAccountCannotSendFriendRequestsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_SEND_MESSAGES]: () => new UnclaimedAccountCannotSendMessagesError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNT_CANNOT_SUBMIT_REPORTS]: () => new UnclaimedAccountCannotSubmitReportsError(),
	[TierDenialErrors.UNCLAIMED_ACCOUNTS_CAN_ONLY_SET_EMAIL_VIA_TOKEN]: (denial) =>
		InputValidationError.fromCode('profile', TierDenialErrors.UNCLAIMED_ACCOUNTS_CAN_ONLY_SET_EMAIL_VIA_TOKEN, {
			need: denial.need,
		}),
};

export function tierDenialError(denial: TierGateDenial): OsacaError {
	return TIER_DENIAL_ERRORS[denial.errorCode](denial);
}

export function assertTierAllows(user: GatedUser, action: TierGatedAction, ctx: TierContext): void {
	const result = evaluateTierGateFor(user, action, ctx);
	if (!result.allowed) throw tierDenialError(result);
}

export function assertCanRegisterPasskey(user: GatedUser): void {
	const result = evaluateTierGateFor(user, TierGatedActions.MFA, NO_TIER_CONTEXT);
	if (!result.allowed && result.need !== AccountVerificationNeeds.SET_PASSWORD) throw tierDenialError(result);
}

export type PurchaseEligibility = {allowed: true} | {allowed: false; blocked: PurchaseBlockedReason};

export function resolvePurchaseEligibility(user: TierUser): PurchaseEligibility {
	const blocked = resolvePurchaseBlockedReason({tier: getAccountTier(user)});
	return blocked === null ? {allowed: true} : {allowed: false, blocked};
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
