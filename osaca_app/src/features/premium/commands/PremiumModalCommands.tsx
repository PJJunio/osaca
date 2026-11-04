// SPDX-License-Identifier: AGPL-3.0-or-later

interface OpenOptions {
	defaultGiftMode?: boolean;
}

// Premium can no longer be bought, so upsells have nowhere to send people. The callers go away with premium itself.
export function open(_options: OpenOptions | boolean = {}): void {}
