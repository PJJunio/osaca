// SPDX-License-Identifier: AGPL-3.0-or-later

import {createHash, randomBytes} from 'node:crypto';

export function sha256Hex(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
	return randomBytes(bytes).toString('base64url');
}
