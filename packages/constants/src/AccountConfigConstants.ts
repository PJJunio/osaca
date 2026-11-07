// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ValueOf} from '@osaca/constants/src/ValueOf';

const HOUR_MS = 60 * 60 * 1000;

export const InteractionTierModes = {
	LEGACY: 'legacy',
	ENFORCED: 'enforced',
} as const;

export type InteractionTierMode = ValueOf<typeof InteractionTierModes>;

export const GuildJoinGates = {
	OFF: 'off',
	VISITS_CAPABLE: 'visits_capable',
	ALWAYS: 'always',
} as const;

export type GuildJoinGate = ValueOf<typeof GuildJoinGates>;

export const InstantAccountAvailability = {
	AVAILABLE: 'available',
	DISABLED: 'disabled',
	CAPTCHA_OFF: 'captcha_off',
	REGISTRATION_CLOSED: 'registration_closed',
	APPROVAL_REQUIRED: 'approval_required',
} as const;

export type InstantAccountAvailability = ValueOf<typeof InstantAccountAvailability>;

export const RegistrationModes = {
	OPEN: 'open',
	APPROVAL: 'approval',
	CLOSED: 'closed',
} as const;

export type RegistrationMode = ValueOf<typeof RegistrationModes>;

export const CleanupModes = {
	OFF: 'off',
	AFTER_INACTIVITY: 'after_inactivity',
} as const;

export const LastSessionCleanupModes = {
	OFF: 'off',
	AFTER_GRACE: 'after_grace',
} as const;

export const AccountCleanupDefaults = {
	SCHEDULED_DELETION_GRACE_MS: 24 * HOUR_MS,
	MIN_ACCOUNT_AGE_MS: 24 * HOUR_MS,
	UNCLAIMED_INACTIVE_DAYS: 90,
	MIN_INACTIVE_DAYS: 1,
	MAX_INACTIVE_DAYS: 3650,
} as const;

export const InstantAccountLimits = {
	MIN_POW_ESCALATION_PER_HOUR: 10,
	MAX_POW_ESCALATION_PER_HOUR: 1_000_000,
	DEFAULT_POW_ESCALATION_PER_HOUR: 2000,
} as const;
