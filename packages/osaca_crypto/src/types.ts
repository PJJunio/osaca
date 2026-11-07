// SPDX-License-Identifier: AGPL-3.0-or-later

export interface IdentityKeyData {
	accountId: string;
	publicKeyBytes: Uint8Array;
	publicKeyHex: string;
	seed: Uint8Array;
}

export interface AccountKeyBundle {
	accountId: string;
	version: number;
	identitySeed: Uint8Array;
	createdAtMs: number;
}

export interface GroupMemberInfo {
	index: number;
	identity: string;
	signatureKey: Uint8Array;
	encryptionKey: Uint8Array;
}

export interface AddMemberResult {
	commit: Uint8Array;
	welcome: Uint8Array;
	epoch: bigint;
}

export type ProcessedMessage =
	| {
			type: 'application';
			epoch: bigint;
			plaintext: Uint8Array;
	  }
	| {
			type: 'commit';
			newEpoch: bigint;
	  }
	| {
			type: 'other';
	  };
