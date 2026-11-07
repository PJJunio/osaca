// SPDX-License-Identifier: AGPL-3.0-or-later

interface TaggedUserLike {
	username: string;
	discriminator: string;
	bot?: boolean | null;
}

const ZERO_DISCRIMINATOR_RE = /^0+$/;

export function shouldShowDiscriminator(user: Pick<TaggedUserLike, 'discriminator' | 'bot'>): boolean {
	if (user.bot) return true;
	return !ZERO_DISCRIMINATOR_RE.test(user.discriminator);
}

export function formatUserTag(user: TaggedUserLike): string {
	return shouldShowDiscriminator(user) ? `${user.username}#${user.discriminator}` : user.username;
}
