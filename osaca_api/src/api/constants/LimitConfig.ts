// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import {GuildFeatures} from '@osaca/constants/src/GuildConstants';
import type {LimitKey} from '@osaca/constants/src/LimitConfigMetadata';
import {LIMIT_KEY_METADATA, LIMIT_KEYS} from '@osaca/constants/src/LimitConfigMetadata';
import {MAX_GUILD_MEMBERS_VERY_LARGE_GUILD} from '@osaca/constants/src/LimitConstants';
import {DEFAULT_LIMITS} from '@osaca/limits/src/LimitDefaults';
import type {LimitConfigSnapshot, LimitRule} from '@osaca/limits/src/LimitTypes';

const LIMIT_RULE_IDS = {
	DEFAULT: 'default',
	VERY_LARGE_GUILD: 'very_large_guild',
} as const;

export const LIMIT_CONFIG_REFRESH_CHANNEL = 'limit-config-refresh';

export interface LimitBuildOptions {
	selfHosted: boolean;
}

export interface StoredLimitConfig extends LimitConfigSnapshot {
	overridesOnly?: boolean;
}

export function normalizeLimitConfig(config: LimitConfigSnapshot): LimitConfigSnapshot {
	return {
		traitDefinitions: Array.isArray(config.traitDefinitions) ? config.traitDefinitions : [],
		rules: Array.isArray(config.rules) ? config.rules : [],
	};
}

export function createDefaultLimitConfig(): LimitConfigSnapshot {
	return {
		traitDefinitions: [],
		rules: [
			{
				id: LIMIT_RULE_IDS.DEFAULT,
				limits: {...DEFAULT_LIMITS},
			},
			{
				id: LIMIT_RULE_IDS.VERY_LARGE_GUILD,
				filters: {guildFeatures: [GuildFeatures.VERY_LARGE_GUILD]},
				limits: {max_guild_members: MAX_GUILD_MEMBERS_VERY_LARGE_GUILD},
			},
		],
	};
}

export function mergeWithCurrentDefaults(stored: LimitConfigSnapshot): LimitConfigSnapshot {
	const newDefaults = createDefaultLimitConfig();
	const defaultBaseRule = newDefaults.rules.find((rule) => rule.id === LIMIT_RULE_IDS.DEFAULT);
	assert(defaultBaseRule, 'Limit configuration defaults must include a default rule');
	const mergedRules: Array<LimitRule> = [];
	const existingRulesMap = new Map<string, LimitRule>();
	for (const rule of stored.rules) {
		existingRulesMap.set(rule.id, {...rule, limits: readKnownLimits(rule.limits)});
	}
	for (const defaultRule of newDefaults.rules) {
		const existingRule = existingRulesMap.get(defaultRule.id);
		if (!existingRule) {
			mergedRules.push({...defaultRule});
			continue;
		}
		const mergedLimits: Partial<Record<LimitKey, number>> = {...defaultRule.limits};
		const modifiedFields = findModifiedLimits(existingRule.limits, defaultRule.limits);
		for (const key of modifiedFields) {
			mergedLimits[key] = existingRule.limits[key];
		}
		mergedRules.push({
			id: existingRule.id,
			filters: existingRule.filters ?? defaultRule.filters,
			limits: mergedLimits,
			modifiedFields: modifiedFields.length > 0 ? modifiedFields : undefined,
		});
		existingRulesMap.delete(defaultRule.id);
	}
	for (const [, rule] of existingRulesMap) {
		if (Object.keys(rule.limits).length === 0) {
			continue;
		}
		const modifiedFields = findModifiedLimits(rule.limits, defaultBaseRule.limits);
		mergedRules.push({
			id: rule.id,
			filters: rule.filters,
			limits: rule.limits,
			modifiedFields: modifiedFields.length > 0 ? modifiedFields : undefined,
		});
	}
	return {
		traitDefinitions: [...new Set([...newDefaults.traitDefinitions, ...stored.traitDefinitions])],
		rules: mergedRules,
	};
}

export function readStoredLimitOverrides(stored: StoredLimitConfig, options: LimitBuildOptions): StoredLimitConfig {
	if (!options.selfHosted || stored.overridesOnly) {
		return stored;
	}
	const defaults = builtInRuleLimits();
	return {
		overridesOnly: true,
		traitDefinitions: stored.traitDefinitions,
		rules: stored.rules.map((rule) => {
			const ruleDefaults = defaults.get(rule.id);
			return {
				id: rule.id,
				filters: rule.filters,
				limits: ruleDefaults ? pickModifiedLimits(rule.limits, ruleDefaults) : rule.limits,
			};
		}),
	};
}

export function buildStoredLimitConfig(
	submitted: LimitConfigSnapshot,
	previous: StoredLimitConfig | null,
	options: LimitBuildOptions,
): StoredLimitConfig {
	const visible = normalizeLimitConfig(submitted);
	if (!options.selfHosted) {
		return mergeWithCurrentDefaults(visible);
	}
	const kept = previous === null ? null : readStoredLimitOverrides(previous, options);
	const keptRules = new Map((kept?.rules ?? []).map((rule) => [rule.id, rule]));
	const defaults = builtInRuleLimits();
	const rules: Array<LimitRule> = visible.rules.map((rule) => {
		const ruleDefaults = defaults.get(rule.id);
		const keptLimits = keptRules.get(rule.id)?.limits ?? {};
		return {
			id: rule.id,
			filters: rule.filters,
			limits: ruleDefaults
				? pickLimits(rule.limits, (key, value) => value !== ruleDefaults[key] || value === keptLimits[key])
				: rule.limits,
		};
	});
	return {
		overridesOnly: true,
		traitDefinitions: visible.traitDefinitions,
		rules,
	};
}

function builtInRuleLimits(): Map<string, Partial<Record<LimitKey, number>>> {
	return new Map(createDefaultLimitConfig().rules.map((rule) => [rule.id, rule.limits]));
}

function readKnownLimits(limits: Partial<Record<LimitKey, number>>): Partial<Record<LimitKey, number>> {
	const known: Partial<Record<LimitKey, number>> = {};
	for (const key of LIMIT_KEYS) {
		const value = limits[key];
		if (value === undefined) {
			continue;
		}
		const {min = 0, max} = LIMIT_KEY_METADATA[key];
		known[key] = max === undefined ? value : Math.min(Math.max(value, min), max);
	}
	return known;
}

function pickModifiedLimits(
	limits: Partial<Record<LimitKey, number>>,
	defaultLimits: Partial<Record<LimitKey, number>>,
): Partial<Record<LimitKey, number>> {
	return pickLimits(limits, (key, value) => value !== defaultLimits[key]);
}

function pickLimits(
	limits: Partial<Record<LimitKey, number>>,
	keep: (key: LimitKey, value: number) => boolean,
): Partial<Record<LimitKey, number>> {
	const picked: Partial<Record<LimitKey, number>> = {};
	for (const key of LIMIT_KEYS) {
		const value = limits[key];
		if (value !== undefined && keep(key, value)) {
			picked[key] = value;
		}
	}
	return picked;
}

function findModifiedLimits(
	currentLimits: Partial<Record<LimitKey, number>>,
	defaultLimits: Partial<Record<LimitKey, number>>,
): Array<LimitKey> {
	return LIMIT_KEYS.filter((key) => {
		const currentValue = currentLimits[key];
		return currentValue !== undefined && currentValue !== defaultLimits[key];
	});
}
