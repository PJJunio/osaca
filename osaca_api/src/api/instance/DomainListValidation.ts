// SPDX-License-Identifier: AGPL-3.0-or-later

import {domainToASCII} from 'node:url';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import {AllowedEmailDomainsSchema, InstanceConfigResponse} from '@osaca/schema/src/domains/admin/AdminSchemas';

const DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TrustedDomainsSchema = InstanceConfigResponse.shape.app_public.shape.branding.shape.trusted_domains;

function throwInvalidDomain(field: string, domain: string): never {
	throw InputValidationError.fromCode(field, ValidationErrorCodes.INVALID_ALLOWED_DOMAIN, {domain});
}

export function normalizeAllowedEmailDomains(domains: unknown, field: string): Array<string> {
	return normalizeDomainList(AllowedEmailDomainsSchema, domains, field, false);
}

export function normalizeTrustedDomains(domains: unknown, field: string): Array<string> {
	return normalizeDomainList(TrustedDomainsSchema, domains, field, true);
}

function normalizeDomainList(
	schema: typeof AllowedEmailDomainsSchema,
	domains: unknown,
	field: string,
	allowWildcard: boolean,
): Array<string> {
	const result = schema.safeParse(domains);
	if (!result.success) throw InputValidationError.fromCode(field, ValidationErrorCodes.INVALID_FORMAT);
	const normalized = new Set<string>();
	for (const rawDomain of result.data) {
		const entry = rawDomain.trim();
		if (!entry) {
			continue;
		}
		const lowered = entry.toLowerCase();
		const wildcard = allowWildcard && lowered.startsWith('*.');
		const host = wildcard ? lowered.slice(2) : lowered;
		if (
			host.includes('@') ||
			host.includes('/') ||
			host.includes('\\') ||
			host.includes(':') ||
			host.startsWith('.') ||
			host.endsWith('.') ||
			host.includes('*')
		) {
			throwInvalidDomain(field, entry);
		}
		const asciiDomain = domainToASCII(host);
		if (!asciiDomain || asciiDomain.length > 253 || !asciiDomain.includes('.')) {
			throwInvalidDomain(field, entry);
		}
		const labels = asciiDomain.split('.');
		if (labels.some((label) => !DOMAIN_LABEL_REGEX.test(label)) || /^\d+$/.test(labels[labels.length - 1] ?? '')) {
			throwInvalidDomain(field, entry);
		}
		normalized.add(wildcard ? `*.${asciiDomain}` : asciiDomain);
	}
	return Array.from(normalized);
}
