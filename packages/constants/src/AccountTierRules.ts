// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	InstantAccountAvailability,
	type InteractionTierMode,
	InteractionTierModes,
	type RegistrationMode,
	RegistrationModes,
} from '@osaca/constants/src/AccountConfigConstants';
import {
	type AccountTier,
	AccountTiers,
	type AccountVerificationNeed,
	AccountVerificationNeeds,
	type LocalCredentialKind,
	LocalCredentialKinds,
	type RestrictedAccountTier,
	type TierDenialError,
	TierDenialErrors,
	type TierExemption,
	TierExemptions,
	type TierGatedAction,
	TierGatedActions,
} from '@osaca/constants/src/AccountTierConstants';
import {type CaptchaProvider, CaptchaProviders} from '@osaca/constants/src/CaptchaConstants';
import type {UserTraitSet} from '@osaca/constants/src/UserTraitConstants';

export interface AccountTierInput {
	isBot: boolean;
	isSystem: boolean;
	traits: UserTraitSet;
	localCredential: LocalCredentialKind;
}

export function resolveAccountTier(input: AccountTierInput): AccountTier {
	if (input.isBot || input.isSystem) return AccountTiers.VERIFIED;
	return input.localCredential !== LocalCredentialKinds.NONE ? AccountTiers.VERIFIED : AccountTiers.UNCLAIMED;
}

export function resolveVerificationNeed(tier: AccountTier): AccountVerificationNeed | null {
	return tier === AccountTiers.UNCLAIMED ? AccountVerificationNeeds.SET_PASSWORD : null;
}

interface TierRule {
	blocksUnclaimed: boolean;
	exemptions?: ReadonlyArray<TierExemption>;
	onlyWhenGuildJoinGateApplies?: true;
}

const ALLOWED: TierRule = {blocksUnclaimed: false};
const BLOCKED: TierRule = {blocksUnclaimed: true};

const SHARED_RULES = {
	[TierGatedActions.REACTION]: BLOCKED,
	[TierGatedActions.FRIEND_REQUEST]: BLOCKED,
	[TierGatedActions.GUILD_CREATE]: BLOCKED,
	[TierGatedActions.GIFT_REDEEM]: BLOCKED,
	[TierGatedActions.REPORT]: BLOCKED,
	[TierGatedActions.MFA]: BLOCKED,
	[TierGatedActions.GUILD_VERIFICATION]: BLOCKED,
	[TierGatedActions.MESSAGE]: BLOCKED,
	[TierGatedActions.DIRECT_MESSAGE]: BLOCKED,
	[TierGatedActions.DIRECT_MESSAGE_OPEN]: BLOCKED,
	[TierGatedActions.GROUP_DM]: BLOCKED,
	[TierGatedActions.FRIEND_ACCEPT]: BLOCKED,
	[TierGatedActions.CALL]: BLOCKED,
	[TierGatedActions.APPLICATION_CREATE]: BLOCKED,
} as const satisfies Partial<Record<TierGatedAction, TierRule>>;

const LEGACY_RULES: Record<TierGatedAction, TierRule> = {
	...SHARED_RULES,
	[TierGatedActions.TYPING]: ALLOWED,
	[TierGatedActions.INVITE_CREATE]: ALLOWED,
	[TierGatedActions.GUILD_JOIN]: ALLOWED,
	[TierGatedActions.VOICE]: {blocksUnclaimed: true, exemptions: [TierExemptions.GUILD_OWNER]},
	[TierGatedActions.GROUP_CALL]: ALLOWED,
	[TierGatedActions.THREAD_JOIN]: ALLOWED,
	[TierGatedActions.CHANNEL_FOLLOW]: ALLOWED,
	[TierGatedActions.OWNERSHIP_TRANSFER]: ALLOWED,
	[TierGatedActions.PROFILE_CUSTOMIZE]: BLOCKED,
};

const ENFORCED_RULES: Record<TierGatedAction, TierRule> = {
	...SHARED_RULES,
	[TierGatedActions.TYPING]: BLOCKED,
	[TierGatedActions.INVITE_CREATE]: BLOCKED,
	[TierGatedActions.GUILD_JOIN]: {blocksUnclaimed: true, onlyWhenGuildJoinGateApplies: true},
	[TierGatedActions.VOICE]: BLOCKED,
	[TierGatedActions.GROUP_CALL]: BLOCKED,
	[TierGatedActions.THREAD_JOIN]: BLOCKED,
	[TierGatedActions.CHANNEL_FOLLOW]: BLOCKED,
	[TierGatedActions.OWNERSHIP_TRANSFER]: BLOCKED,
	[TierGatedActions.PROFILE_CUSTOMIZE]: ALLOWED,
};

const TIER_RULES: Readonly<Record<InteractionTierMode, Readonly<Record<TierGatedAction, TierRule>>>> = {
	[InteractionTierModes.LEGACY]: LEGACY_RULES,
	[InteractionTierModes.ENFORCED]: ENFORCED_RULES,
};

export interface TierGateInput {
	tier: AccountTier;
	mode: InteractionTierMode;
	action: TierGatedAction;
	guildJoinGateApplies: boolean;
	exemptions: ReadonlyArray<TierExemption>;
}

export interface TierGateDenial {
	allowed: false;
	action: TierGatedAction;
	tier: RestrictedAccountTier;
	need: AccountVerificationNeed;
	errorCode: TierDenialError;
}

export type TierGateResult = {allowed: true} | TierGateDenial;

const TIER_GATE_ALLOWED: TierGateResult = {allowed: true};

export function evaluateTierGate(input: TierGateInput): TierGateResult {
	const {tier} = input;
	if (tier === AccountTiers.VERIFIED) return TIER_GATE_ALLOWED;
	const rule = TIER_RULES[input.mode][input.action];
	if (!rule.blocksUnclaimed) return TIER_GATE_ALLOWED;
	if (rule.onlyWhenGuildJoinGateApplies && !input.guildJoinGateApplies) return TIER_GATE_ALLOWED;
	if (rule.exemptions?.some((exemption) => input.exemptions.includes(exemption))) return TIER_GATE_ALLOWED;
	return {
		allowed: false,
		action: input.action,
		tier,
		need: AccountVerificationNeeds.SET_PASSWORD,
		errorCode: TierDenialErrors.ACCOUNT_VERIFICATION_REQUIRED,
	};
}

export function resolveInstantAccountAvailability(params: {
	enabled: boolean;
	captchaProvider: CaptchaProvider;
	registrationMode: RegistrationMode;
	registrationUrl: {approvalRequired: boolean} | null;
}): InstantAccountAvailability {
	if (!params.enabled) return InstantAccountAvailability.DISABLED;
	if (params.captchaProvider === CaptchaProviders.NONE) return InstantAccountAvailability.CAPTCHA_OFF;
	if (params.registrationUrl !== null) {
		return params.registrationUrl.approvalRequired
			? InstantAccountAvailability.APPROVAL_REQUIRED
			: InstantAccountAvailability.AVAILABLE;
	}
	switch (params.registrationMode) {
		case RegistrationModes.OPEN:
			return InstantAccountAvailability.AVAILABLE;
		case RegistrationModes.APPROVAL:
			return InstantAccountAvailability.APPROVAL_REQUIRED;
		case RegistrationModes.CLOSED:
			return InstantAccountAvailability.REGISTRATION_CLOSED;
	}
}
