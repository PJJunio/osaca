// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import {userGuildVisitsActive} from '@app/api/experiment/GuildVisitsGate';
import {
	AccountCleanupDefaults,
	CleanupModes,
	type GuildJoinGate,
	GuildJoinGates,
	InstantAccountLimits,
	type InteractionTierMode,
	InteractionTierModes,
	LastSessionCleanupModes,
} from '@osaca/constants/src/AccountConfigConstants';
import type {AccountsConfig, AuthConfig} from '@osaca/schema/src/domains/admin/AccountsConfigSchemas';

export interface AccountsConfigDefaults {
	auth: AuthConfig;
	accounts: AccountsConfig;
}

export function abandonedAccountCleanupDefaults(on: boolean): Pick<AccountsConfig, 'unclaimed_account_cleanup'> {
	return {
		unclaimed_account_cleanup: {
			mode: on ? CleanupModes.AFTER_INACTIVITY : CleanupModes.OFF,
			inactive_days: AccountCleanupDefaults.UNCLAIMED_INACTIVE_DAYS,
			on_last_session_end: on ? LastSessionCleanupModes.AFTER_GRACE : LastSessionCleanupModes.OFF,
		},
	};
}

export function hostedAccountsDefaults(): AccountsConfigDefaults {
	return {
		auth: {
			instant_accounts: {enabled: true, pow_escalation_per_hour: InstantAccountLimits.DEFAULT_POW_ESCALATION_PER_HOUR},
		},
		accounts: {
			interaction_tier: InteractionTierModes.LEGACY,
			guild_join_gate: GuildJoinGates.ALWAYS,
			...abandonedAccountCleanupDefaults(false),
		},
	};
}

export function selfHostedAccountsDefaults(params: {freshInstall: boolean}): AccountsConfigDefaults {
	return {
		auth: {
			instant_accounts: {enabled: false, pow_escalation_per_hour: InstantAccountLimits.DEFAULT_POW_ESCALATION_PER_HOUR},
		},
		accounts: {
			interaction_tier: params.freshInstall ? InteractionTierModes.ENFORCED : InteractionTierModes.LEGACY,
			guild_join_gate: GuildJoinGates.ALWAYS,
			...abandonedAccountCleanupDefaults(params.freshInstall),
		},
	};
}

export function fallbackAccountsDefaults(): AccountsConfigDefaults {
	if (!Config.instance.selfHosted) return hostedAccountsDefaults();
	return selfHostedAccountsDefaults({freshInstall: false});
}

let cachedAccounts: AccountsConfig | null = null;

export function getCachedAccountsConfig(): AccountsConfig {
	return cachedAccounts ?? fallbackAccountsDefaults().accounts;
}

export function setCachedAccountsConfig(config: AccountsConfig | null): void {
	cachedAccounts = config;
}

export function getInteractionTierMode(): InteractionTierMode {
	return getCachedAccountsConfig().interaction_tier;
}

function getGuildJoinGate(): GuildJoinGate {
	return getCachedAccountsConfig().guild_join_gate;
}

export function guildJoinGateApplies(params: {userId: UserID; visitsCapable: boolean}): boolean {
	const gate = getGuildJoinGate();
	if (gate === GuildJoinGates.OFF) return false;
	if (!userGuildVisitsActive(params.userId)) return false;
	return gate === GuildJoinGates.ALWAYS || params.visitsCapable;
}
