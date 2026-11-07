// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AccountKeyBundle} from './types.js';
import {callWithJsonResult, callWithResult, freeWasm, getWasm, passBytes} from './wasm.js';

interface RawBundleJson {
	account_id: string;
	version: number;
	identity_seed: Array<number>;
	created_at_ms: number;
}

export const RecoveryKit = {
	generateSecret(): Uint8Array {
		const wasm = getWasm();
		return callWithResult((outPtr) => wasm.crypto_recovery_secret_generate(outPtr));
	},

	encryptBundle(secret: Uint8Array, bundle: AccountKeyBundle): Uint8Array {
		if (secret.byteLength !== 32) {
			throw new Error(`Recovery secret must be exactly 32 bytes, got ${secret.byteLength}`);
		}
		if (bundle.identitySeed.byteLength !== 32) {
			throw new Error(`Identity seed must be exactly 32 bytes, got ${bundle.identitySeed.byteLength}`);
		}

		const wasm = getWasm();
		const rawJson: RawBundleJson = {
			account_id: bundle.accountId,
			version: bundle.version,
			identity_seed: Array.from(bundle.identitySeed),
			created_at_ms: bundle.createdAtMs,
		};
		const bundleBytes = new TextEncoder().encode(JSON.stringify(rawJson));

		const {ptr: secretPtr, len: secretLen} = passBytes(secret);
		const {ptr: bundlePtr, len: bundleLen} = passBytes(bundleBytes);

		try {
			return callWithResult((outPtr) =>
				wasm.crypto_recovery_encrypt(secretPtr, secretLen, bundlePtr, bundleLen, outPtr),
			);
		} finally {
			freeWasm(secretPtr, secretLen);
			freeWasm(bundlePtr, bundleLen);
		}
	},

	decryptBundle(secret: Uint8Array, ciphertext: Uint8Array): AccountKeyBundle {
		if (secret.byteLength !== 32) {
			throw new Error(`Recovery secret must be exactly 32 bytes, got ${secret.byteLength}`);
		}

		const wasm = getWasm();
		const {ptr: secretPtr, len: secretLen} = passBytes(secret);
		const {ptr: cipherPtr, len: cipherLen} = passBytes(ciphertext);

		try {
			const res = callWithJsonResult<RawBundleJson>((outPtr) =>
				wasm.crypto_recovery_decrypt(secretPtr, secretLen, cipherPtr, cipherLen, outPtr),
			);
			return {
				accountId: res.account_id,
				version: res.version,
				identitySeed: new Uint8Array(res.identity_seed),
				createdAtMs: res.created_at_ms,
			};
		} finally {
			freeWasm(secretPtr, secretLen);
			freeWasm(cipherPtr, cipherLen);
		}
	},
};
export type RecoveryKit = typeof RecoveryKit;
