// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	buildStoredLimitConfig,
	createDefaultLimitConfig,
	mergeWithCurrentDefaults,
	normalizeLimitConfig,
	readStoredLimitOverrides,
} from '@app/api/constants/LimitConfig';
import {DEFAULT_LIMITS} from '@osaca/limits/src/LimitDefaults';
import type {LimitConfigSnapshot, LimitRule} from '@osaca/limits/src/LimitTypes';
import {describe, expect, test} from 'vitest';

describe('Limit config storage', () => {
	const selfHosted = {selfHosted: true} as const;
	const hosted = {selfHosted: false} as const;

	function defaultRuleConfig(rule: Omit<LimitRule, 'id'>): LimitConfigSnapshot {
		return {traitDefinitions: [], rules: [{id: 'default', ...rule}]};
	}

	function fullConfig(): LimitConfigSnapshot {
		const {traitDefinitions, rules} = createDefaultLimitConfig();
		return {traitDefinitions, rules};
	}

	function withLimits(config: LimitConfigSnapshot, ruleId: string, limits: LimitRule['limits']): LimitConfigSnapshot {
		return {
			traitDefinitions: config.traitDefinitions,
			rules: config.rules.map((rule) => (rule.id === ruleId ? {...rule, limits: {...rule.limits, ...limits}} : rule)),
		};
	}

	function load(stored: LimitConfigSnapshot): LimitConfigSnapshot {
		return mergeWithCurrentDefaults(
			normalizeLimitConfig(readStoredLimitOverrides(structuredClone(stored), selfHosted)),
		);
	}

	function limitsOf(config: LimitConfigSnapshot, ruleId: string): LimitRule['limits'] | undefined {
		return config.rules.find((rule) => rule.id === ruleId)?.limits;
	}

	test('the defaults have no trait rules', () => {
		const defaults = createDefaultLimitConfig();
		expect(defaults.traitDefinitions).toEqual([]);
		expect(defaults.rules.every((rule) => rule.filters?.traits === undefined)).toBe(true);
		expect(limitsOf(defaults, 'default')).toEqual(DEFAULT_LIMITS);
	});

	test('built-in rules keep only values that differ from the defaults', () => {
		const stored = buildStoredLimitConfig(
			{
				traitDefinitions: ['vip'],
				rules: [
					{id: 'default', limits: {...DEFAULT_LIMITS, max_guilds: 250}, modifiedFields: ['max_guilds']},
					{id: 'vip', filters: {traits: ['vip']}, limits: {max_guilds: 300}},
				],
			},
			null,
			selfHosted,
		);
		expect(stored.rules).toEqual([
			{id: 'default', limits: {max_guilds: 250}},
			{id: 'vip', filters: {traits: ['vip']}, limits: {max_guilds: 300}},
		]);
	});

	test('hosted instances keep storing whole rules', () => {
		const submitted = withLimits(fullConfig(), 'default', {max_guilds: 150});
		const stored = buildStoredLimitConfig(submitted, null, hosted);
		expect(stored).toEqual(mergeWithCurrentDefaults(submitted));
		expect(limitsOf(stored, 'default')).toEqual({...DEFAULT_LIMITS, max_guilds: 150});
		expect(readStoredLimitOverrides(stored, hosted)).toBe(stored);
	});

	test('a whole default rule saved in the old format keeps only its edits', () => {
		const stored = defaultRuleConfig({
			limits: {...DEFAULT_LIMITS, max_guilds: 150, max_bio_length: 300},
			modifiedFields: ['max_guilds', 'max_bio_length'],
		});
		expect(readStoredLimitOverrides(stored, selfHosted).rules).toEqual([
			{id: 'default', limits: {max_guilds: 150, max_bio_length: 300}},
		]);
	});

	test('overrides saved in the current format are never reinterpreted', () => {
		const stored = buildStoredLimitConfig(withLimits(fullConfig(), 'default', {max_guilds: 150}), null, selfHosted);
		expect(readStoredLimitOverrides(stored, selfHosted)).toBe(stored);
		expect(limitsOf(load(stored), 'default')).toEqual({...DEFAULT_LIMITS, max_guilds: 150});
	});

	test('a value moved back to the default stops being stored', () => {
		const saved = buildStoredLimitConfig(withLimits(fullConfig(), 'default', {max_guilds: 150}), null, selfHosted);
		const reverted = buildStoredLimitConfig(fullConfig(), saved, selfHosted);
		expect(limitsOf(reverted, 'default')).toEqual({});
	});

	test('a stored rule for the old premium trait is an ordinary trait rule', () => {
		const loaded = load({
			traitDefinitions: ['premium'],
			rules: [{id: 'premium', filters: {traits: ['premium']}, limits: {max_guilds: 250}}],
		});
		expect(loaded.traitDefinitions).toEqual(['premium']);
		expect(limitsOf(loaded, 'premium')).toEqual({max_guilds: 250});
		expect(limitsOf(loaded, 'default')).toEqual(DEFAULT_LIMITS);
	});
});
