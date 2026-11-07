// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	InstantAccountAvailability,
	type InteractionTierMode,
	InteractionTierModes,
	RegistrationModes,
} from '@osaca/constants/src/AccountConfigConstants';
import {
	AccountTiers,
	AccountVerificationNeeds,
	LocalCredentialKinds,
	localCredentialKindOf,
	TierDenialErrors,
	TierExemptions,
	type TierGatedAction,
	TierGatedActions,
} from '@osaca/constants/src/AccountTierConstants';
import {
	type AccountTierInput,
	evaluateTierGate,
	resolveAccountTier,
	resolveInstantAccountAvailability,
	resolveVerificationNeed,
	type TierGateInput,
} from '@osaca/constants/src/AccountTierRules';
import {CaptchaProviders} from '@osaca/constants/src/CaptchaConstants';
import {describe, expect, it} from 'vitest';

const ALL_ACTIONS = Object.values(TierGatedActions);
const A = TierGatedActions;

const BLOCKED_FOR_UNCLAIMED: Record<InteractionTierMode, ReadonlyArray<TierGatedAction>> = {
	[InteractionTierModes.LEGACY]: [
		A.MESSAGE,
		A.REACTION,
		A.DIRECT_MESSAGE,
		A.DIRECT_MESSAGE_OPEN,
		A.GROUP_DM,
		A.FRIEND_REQUEST,
		A.FRIEND_ACCEPT,
		A.GUILD_CREATE,
		A.VOICE,
		A.CALL,
		A.APPLICATION_CREATE,
		A.GIFT_REDEEM,
		A.PROFILE_CUSTOMIZE,
		A.REPORT,
		A.MFA,
		A.GUILD_VERIFICATION,
	],
	[InteractionTierModes.ENFORCED]: ALL_ACTIONS.filter((action) => action !== A.PROFILE_CUSTOMIZE),
};

function gate(overrides: Partial<TierGateInput>) {
	return evaluateTierGate({
		tier: AccountTiers.UNCLAIMED,
		mode: InteractionTierModes.LEGACY,
		action: A.MESSAGE,
		guildJoinGateApplies: true,
		exemptions: [],
		...overrides,
	});
}

describe('evaluateTierGate matrix', () => {
	const cases = Object.values(InteractionTierModes).flatMap((mode) =>
		ALL_ACTIONS.flatMap((action) =>
			[AccountTiers.UNCLAIMED, AccountTiers.VERIFIED].map((tier) => {
				const denied = tier === AccountTiers.UNCLAIMED && BLOCKED_FOR_UNCLAIMED[mode].includes(action);
				const expected = denied
					? {
							allowed: false,
							action,
							tier,
							need: AccountVerificationNeeds.SET_PASSWORD,
							errorCode: TierDenialErrors.ACCOUNT_VERIFICATION_REQUIRED,
						}
					: {allowed: true};
				return {mode, action, tier, expected};
			}),
		),
	);

	it.each(cases)('$mode $tier $action', ({expected, ...input}) => {
		expect(gate(input)).toEqual(expected);
	});
});

describe('evaluateTierGate conditions', () => {
	it('applies the enforced join gate only when it applies to the person', () => {
		const join = {mode: InteractionTierModes.ENFORCED, action: A.GUILD_JOIN};
		expect(gate({...join, guildJoinGateApplies: false}).allowed).toBe(true);
		expect(gate({...join, guildJoinGateApplies: true}).allowed).toBe(false);
	});

	it('lets community owners into voice under legacy, never under enforced', () => {
		const owner = {action: A.VOICE, exemptions: [TierExemptions.GUILD_OWNER]};
		expect(gate({...owner, mode: InteractionTierModes.LEGACY}).allowed).toBe(true);
		expect(gate({...owner, mode: InteractionTierModes.ENFORCED}).allowed).toBe(false);
		expect(gate({action: A.VOICE, mode: InteractionTierModes.LEGACY}).allowed).toBe(false);
	});
});

describe('resolveVerificationNeed', () => {
	it('asks unclaimed accounts to set a password and nothing of verified ones', () => {
		expect(resolveVerificationNeed(AccountTiers.UNCLAIMED)).toBe(AccountVerificationNeeds.SET_PASSWORD);
		expect(resolveVerificationNeed(AccountTiers.VERIFIED)).toBeNull();
	});
});

describe('resolveAccountTier', () => {
	const base: AccountTierInput = {
		isBot: false,
		isSystem: false,
		traits: new Set<string>(),
		localCredential: LocalCredentialKinds.NONE,
	};

	it('treats bots and system accounts as verified', () => {
		expect(resolveAccountTier({...base, isBot: true})).toBe(AccountTiers.VERIFIED);
		expect(resolveAccountTier({...base, isSystem: true})).toBe(AccountTiers.VERIFIED);
	});

	it('is verified once the account has any local credential', () => {
		expect(resolveAccountTier(base)).toBe(AccountTiers.UNCLAIMED);
		for (const localCredential of [
			LocalCredentialKinds.PASSWORD,
			LocalCredentialKinds.PASSKEY,
			LocalCredentialKinds.PASSWORD_AND_PASSKEY,
		]) {
			expect(resolveAccountTier({...base, localCredential})).toBe(AccountTiers.VERIFIED);
		}
	});
});

describe('localCredentialKindOf', () => {
	it('combines a password and a passkey', () => {
		expect(localCredentialKindOf({hasPassword: false, hasPasskey: false})).toBe(LocalCredentialKinds.NONE);
		expect(localCredentialKindOf({hasPassword: true, hasPasskey: false})).toBe(LocalCredentialKinds.PASSWORD);
		expect(localCredentialKindOf({hasPassword: false, hasPasskey: true})).toBe(LocalCredentialKinds.PASSKEY);
		expect(localCredentialKindOf({hasPassword: true, hasPasskey: true})).toBe(
			LocalCredentialKinds.PASSWORD_AND_PASSKEY,
		);
	});
});

describe('resolveInstantAccountAvailability', () => {
	const open = {
		enabled: true,
		captchaProvider: CaptchaProviders.ALTCHA,
		registrationMode: RegistrationModes.OPEN,
		registrationUrl: null,
	};

	it('is available while enabled, with a captcha and open sign-ups', () => {
		expect(resolveInstantAccountAvailability(open)).toBe(InstantAccountAvailability.AVAILABLE);
	});

	it('reports why it is unavailable, in order', () => {
		expect(resolveInstantAccountAvailability({...open, enabled: false, captchaProvider: CaptchaProviders.NONE})).toBe(
			InstantAccountAvailability.DISABLED,
		);
		expect(resolveInstantAccountAvailability({...open, captchaProvider: CaptchaProviders.NONE})).toBe(
			InstantAccountAvailability.CAPTCHA_OFF,
		);
		expect(resolveInstantAccountAvailability({...open, registrationMode: RegistrationModes.APPROVAL})).toBe(
			InstantAccountAvailability.APPROVAL_REQUIRED,
		);
		expect(resolveInstantAccountAvailability({...open, registrationMode: RegistrationModes.CLOSED})).toBe(
			InstantAccountAvailability.REGISTRATION_CLOSED,
		);
	});

	it('follows a registration URL over the registration mode', () => {
		for (const registrationMode of Object.values(RegistrationModes)) {
			expect(
				resolveInstantAccountAvailability({...open, registrationMode, registrationUrl: {approvalRequired: false}}),
			).toBe(InstantAccountAvailability.AVAILABLE);
			expect(
				resolveInstantAccountAvailability({...open, registrationMode, registrationUrl: {approvalRequired: true}}),
			).toBe(InstantAccountAvailability.APPROVAL_REQUIRED);
		}
	});
});
