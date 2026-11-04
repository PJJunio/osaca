// SPDX-License-Identifier: AGPL-3.0-or-later

import {getProtectedLocalStorage} from '@app/features/platform/state/ProtectedWebStorage';
import {Logger} from '@app/features/platform/utils/AppLogger';

const logger = new Logger('AccountEntryStorage');

const DEVICE_PROOF_KEY_PREFIX = 'osaca.device_proof.';

function readItem(key: string): string | null {
	try {
		return getProtectedLocalStorage()?.getItem(key) ?? null;
	} catch (error) {
		logger.warn('Failed to read account entry storage', error);
		return null;
	}
}

function writeItem(key: string, value: string): void {
	try {
		getProtectedLocalStorage()?.setItem(key, value);
	} catch (error) {
		logger.warn('Failed to write account entry storage', error);
	}
}

export function readDeviceProof(userId: string): string | null {
	return readItem(`${DEVICE_PROOF_KEY_PREFIX}${userId}`);
}

export function storeDeviceProof(userId: string, deviceProof: string | undefined): void {
	if (deviceProof === undefined || deviceProof === '') {
		return;
	}
	writeItem(`${DEVICE_PROOF_KEY_PREFIX}${userId}`, deviceProof);
}

