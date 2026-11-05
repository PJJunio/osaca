// SPDX-License-Identifier: AGPL-3.0-or-later

export function resolveEffectiveUserTraits(storedTraits: Iterable<string> | null | undefined): Set<string> {
	const traits = new Set<string>();
	for (const trait of storedTraits ?? []) {
		const normalized = trait.trim().toLowerCase();
		if (normalized) traits.add(normalized);
	}
	return traits;
}
