// SPDX-License-Identifier: AGPL-3.0-or-later

import {LimitResolver} from '@app/features/app/utils/LimitResolverAdapter';
import type {User} from '@app/features/user/models/User';
import Users from '@app/features/user/state/Users';
import {DEFAULT_LIMITS} from '@osaca/limits/src/LimitDefaults';

const FALLBACKS = {
	max_message_length: DEFAULT_LIMITS.max_message_length,
	max_attachments_per_message: DEFAULT_LIMITS.max_attachments_per_message,
	max_group_dm_recipients: DEFAULT_LIMITS.max_group_dm_recipients,
} as const;

class LimitsClass {
	private getCurrentUser(): User | undefined {
		return Users.getCurrentUser();
	}

	getMaxMessageLength(): number {
		const user = this.getCurrentUser();
		if (user?.maxMessageLength) return user.maxMessageLength;
		return LimitResolver.resolve({key: 'max_message_length', fallback: FALLBACKS.max_message_length});
	}

	getMaxAttachmentsPerMessage(): number {
		const user = this.getCurrentUser();
		if (user?.maxAttachmentsPerMessage) return user.maxAttachmentsPerMessage;
		return LimitResolver.resolve({key: 'max_attachments_per_message', fallback: FALLBACKS.max_attachments_per_message});
	}

	getMaxGroupDmRecipients(): number {
		const user = this.getCurrentUser();
		if (user?.maxGroupDmRecipients) return user.maxGroupDmRecipients;
		return LimitResolver.resolve({key: 'max_group_dm_recipients', fallback: FALLBACKS.max_group_dm_recipients});
	}
}

export const Limits = new LimitsClass();
