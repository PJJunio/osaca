// SPDX-License-Identifier: AGPL-3.0-or-later

import {AccountCleanupDefaults, InstantAccountLimits} from '@osaca/constants/src/AccountConfigConstants';
import {
	CleanupModeSchema,
	GuildJoinGateSchema,
	InteractionTierModeSchema,
	LastSessionCleanupModeSchema,
} from '@osaca/schema/src/domains/account/AccountTierSchemas';
import {z} from 'zod';

const InstantAccountsConfigSchema = z.object({
	enabled: z.boolean().describe('Whether accounts can be created from just a display name. Needs the captcha to be on'),
	pow_escalation_per_hour: z
		.number()
		.int()
		.min(InstantAccountLimits.MIN_POW_ESCALATION_PER_HOUR)
		.max(InstantAccountLimits.MAX_POW_ESCALATION_PER_HOUR)
		.describe('Every this many accounts created from a display name in the current hour doubles the captcha cost'),
});

export const AuthConfigSchema = z.object({
	instant_accounts: InstantAccountsConfigSchema,
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

const InactiveDaysSchema = z
	.number()
	.int()
	.min(AccountCleanupDefaults.MIN_INACTIVE_DAYS)
	.max(AccountCleanupDefaults.MAX_INACTIVE_DAYS);

const UnclaimedAccountCleanupSchema = z.object({
	mode: CleanupModeSchema.describe('Whether accounts that can never be signed in to again are deleted'),
	inactive_days: InactiveDaysSchema.describe('Days without use before such an account is deleted'),
	on_last_session_end: LastSessionCleanupModeSchema,
});

export const AccountsConfigSchema = z.object({
	interaction_tier: InteractionTierModeSchema,
	guild_join_gate: GuildJoinGateSchema,
	unclaimed_account_cleanup: UnclaimedAccountCleanupSchema,
});

export type AccountsConfig = z.infer<typeof AccountsConfigSchema>;

export const AuthConfigUpdateRequest = z.object({
	instant_accounts: InstantAccountsConfigSchema.partial().optional(),
});

export type AuthConfigUpdateRequest = z.infer<typeof AuthConfigUpdateRequest>;

export const AccountsConfigUpdateRequest = z.object({
	interaction_tier: InteractionTierModeSchema.optional(),
	guild_join_gate: GuildJoinGateSchema.optional(),
	unclaimed_account_cleanup: UnclaimedAccountCleanupSchema.partial().optional(),
	abandoned_account_cleanup: z.boolean().optional().describe('Deprecated, use unclaimed_account_cleanup'),
});

export type AccountsConfigUpdateRequest = z.infer<typeof AccountsConfigUpdateRequest>;
