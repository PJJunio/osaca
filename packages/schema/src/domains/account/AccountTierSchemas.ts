// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	CleanupModes,
	GuildJoinGates,
	InstantAccountAvailability,
	InteractionTierModes,
	LastSessionCleanupModes,
} from '@osaca/constants/src/AccountConfigConstants';
import {AccountTiers, AccountVerificationNeeds} from '@osaca/constants/src/AccountTierConstants';
import {CaptchaProviders} from '@osaca/constants/src/CaptchaConstants';
import {
	createNamedLiteral,
	createNamedStringLiteralUnion,
	withOpenApiType,
} from '@osaca/schema/src/primitives/SchemaPrimitives';

export const AccountTierSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			[AccountTiers.UNCLAIMED, 'UNCLAIMED', 'The account has no way to sign in from another device yet'],
			[AccountTiers.VERIFIED, 'VERIFIED', 'The account has finished setting up and can use everything'],
		],
		'How far the account has got with setting up a way to sign in',
	),
	'AccountTier',
);

export const AccountVerificationNeedSchema = withOpenApiType(
	createNamedLiteral(
		AccountVerificationNeeds.SET_PASSWORD,
		'SET_PASSWORD',
		'Set a password, or add a passkey, on the account',
	),
	'AccountVerificationNeed',
);

export const CaptchaProviderSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			[CaptchaProviders.NONE, 'NONE', 'No captcha is asked for'],
			[CaptchaProviders.ALTCHA, 'ALTCHA', 'An ALTCHA proof of work is asked for'],
		],
		'Captcha the instance asks for',
	),
	'CaptchaProvider',
);

export const InstantAccountAvailabilitySchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			[InstantAccountAvailability.AVAILABLE, 'AVAILABLE', 'Accounts can be created from a display name'],
			[InstantAccountAvailability.DISABLED, 'DISABLED', 'Instant accounts are turned off'],
			[InstantAccountAvailability.CAPTCHA_OFF, 'CAPTCHA_OFF', 'Instant accounts need the captcha, which is off'],
			[InstantAccountAvailability.REGISTRATION_CLOSED, 'REGISTRATION_CLOSED', 'Public registration is closed'],
			[
				InstantAccountAvailability.APPROVAL_REQUIRED,
				'APPROVAL_REQUIRED',
				'New accounts need approval, so they need credentials to sign in once approved',
			],
		],
		'Whether accounts can be created from just a display name, and why not',
	),
	'InstantAccountAvailability',
);

export const InteractionTierModeSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			[InteractionTierModes.LEGACY, 'LEGACY', 'Accounts that have not finished setting up keep the older limits'],
			[
				InteractionTierModes.ENFORCED,
				'ENFORCED',
				'Accounts that have not finished setting up may only do things that do not reach other people',
			],
		],
		'Which limits apply to accounts that have not finished setting up',
	),
	'InteractionTierMode',
);

export const GuildJoinGateSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			[GuildJoinGates.OFF, 'OFF', 'Joining a community never needs a finished account'],
			[
				GuildJoinGates.VISITS_CAPABLE,
				'VISITS_CAPABLE',
				'Joining needs a finished account only in clients that can preview communities',
			],
			[GuildJoinGates.ALWAYS, 'ALWAYS', 'Joining needs a finished account in every client'],
		],
		'When joining a community needs a finished account. Applies only while the interaction tier is enforced and the person can preview communities',
	),
	'GuildJoinGate',
);

export const CleanupModeSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			[CleanupModes.OFF, 'OFF', 'Accounts are never deleted by this policy'],
			[
				CleanupModes.AFTER_INACTIVITY,
				'AFTER_INACTIVITY',
				'Accounts are deleted after the set number of days without use',
			],
		],
		'Whether a cleanup policy deletes accounts',
	),
	'CleanupMode',
);

export const LastSessionCleanupModeSchema = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			[LastSessionCleanupModes.OFF, 'OFF', 'Signing out of the last session deletes nothing'],
			[
				LastSessionCleanupModes.AFTER_GRACE,
				'AFTER_GRACE',
				'Signing out of the last session schedules the account for deletion after a grace period',
			],
		],
		'What happens when an account with no way back in signs out of its last session',
	),
	'LastSessionCleanupMode',
);
