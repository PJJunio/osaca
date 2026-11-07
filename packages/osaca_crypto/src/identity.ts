// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AccountKeyBundle} from './types.js';
import {callWithJsonResult, freeWasm, getWasm, passBytes, passString} from './wasm.js';

interface RawIdentityJson {
	account_id: string;
	seed: Array<number>;
	public_key_bytes: Array<number>;
	public_key_hex: string;
}

export class IdentityKey {
	readonly accountId: string;
	readonly publicKeyBytes: Uint8Array;
	readonly publicKeyHex: string;
	readonly seed: Uint8Array;

	constructor(accountId: string, publicKeyBytes: Uint8Array, publicKeyHex: string, seed: Uint8Array) {
		this.accountId = accountId;
		this.publicKeyBytes = publicKeyBytes;
		this.publicKeyHex = publicKeyHex;
		this.seed = seed;
	}

	static generate(accountId: string): IdentityKey {
		const wasm = getWasm();
		const {ptr: idPtr, len: idLen} = passString(accountId);
		try {
			const res = callWithJsonResult<RawIdentityJson>((outPtr) => wasm.crypto_identity_generate(idPtr, idLen, outPtr));
			return new IdentityKey(
				res.account_id,
				new Uint8Array(res.public_key_bytes),
				res.public_key_hex,
				new Uint8Array(res.seed),
			);
		} finally {
			freeWasm(idPtr, idLen);
		}
	}

	static fromSeed(accountId: string, seed: Uint8Array): IdentityKey {
		if (seed.byteLength !== 32) {
			throw new Error(`Identity seed must be exactly 32 bytes, got ${seed.byteLength}`);
		}
		const wasm = getWasm();
		const {ptr: idPtr, len: idLen} = passString(accountId);
		const {ptr: seedPtr, len: seedLen} = passBytes(seed);
		try {
			const res = callWithJsonResult<RawIdentityJson>((outPtr) =>
				wasm.crypto_identity_from_seed(idPtr, idLen, seedPtr, seedLen, outPtr),
			);
			return new IdentityKey(
				res.account_id,
				new Uint8Array(res.public_key_bytes),
				res.public_key_hex,
				new Uint8Array(res.seed),
			);
		} finally {
			freeWasm(idPtr, idLen);
			freeWasm(seedPtr, seedLen);
		}
	}

	createAccountKeyBundle(createdAtMs: number = Date.now()): AccountKeyBundle {
		return {
			accountId: this.accountId,
			version: 1,
			identitySeed: new Uint8Array(this.seed),
			createdAtMs,
		};
	}
}
