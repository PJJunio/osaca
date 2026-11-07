// SPDX-License-Identifier: AGPL-3.0-or-later

import type {AddMemberResult, GroupMemberInfo, ProcessedMessage} from './types.js';
import {callWithJsonResult, callWithResult, freeWasm, getWasm, passBytes, passString} from './wasm.js';

interface RawDeviceCreateJson {
	handle: number;
}

interface RawGroupCreateJson {
	handle: number;
	epoch: number;
}

interface RawAddMemberJson {
	commit: Array<number>;
	welcome: Array<number>;
	epoch: number;
}

interface RawProcessedMessageJson {
	kind: 'application' | 'commit' | 'other';
	epoch?: number;
	plaintext?: Array<number>;
}

interface RawMemberInfoJson {
	index: number;
	identity: string;
	signature_key: Array<number>;
	encryption_key: Array<number>;
}

export class DeviceSession {
	readonly accountId: string;
	readonly deviceId: string;
	readonly handle: bigint;

	private constructor(accountId: string, deviceId: string, handle: bigint) {
		this.accountId = accountId;
		this.deviceId = deviceId;
		this.handle = handle;
	}

	static create(accountId: string, deviceId: string): DeviceSession {
		const wasm = getWasm();
		const {ptr: idPtr, len: idLen} = passString(accountId);
		const {ptr: devPtr, len: devLen} = passString(deviceId);

		try {
			const res = callWithJsonResult<RawDeviceCreateJson>((outPtr) =>
				wasm.crypto_device_create(idPtr, idLen, devPtr, devLen, outPtr),
			);
			return new DeviceSession(accountId, deviceId, BigInt(res.handle));
		} finally {
			freeWasm(idPtr, idLen);
			freeWasm(devPtr, devLen);
		}
	}

	generateKeyPackage(): Uint8Array {
		const wasm = getWasm();
		return callWithResult((outPtr) => wasm.crypto_device_generate_key_package(this.handle, outPtr));
	}
}

export class MlsGroupSession {
	readonly handle: bigint;

	private constructor(handle: bigint) {
		this.handle = handle;
	}

	static create(device: DeviceSession, groupId: Uint8Array): MlsGroupSession {
		const wasm = getWasm();
		const {ptr: gidPtr, len: gidLen} = passBytes(groupId);

		try {
			const res = callWithJsonResult<RawGroupCreateJson>((outPtr) =>
				wasm.crypto_group_create(device.handle, gidPtr, gidLen, outPtr),
			);
			return new MlsGroupSession(BigInt(res.handle));
		} finally {
			freeWasm(gidPtr, gidLen);
		}
	}

	static joinFromWelcome(device: DeviceSession, welcomeBytes: Uint8Array): MlsGroupSession {
		const wasm = getWasm();
		const {ptr: wPtr, len: wLen} = passBytes(welcomeBytes);

		try {
			const res = callWithJsonResult<RawGroupCreateJson>((outPtr) =>
				wasm.crypto_group_join_welcome(device.handle, wPtr, wLen, outPtr),
			);
			return new MlsGroupSession(BigInt(res.handle));
		} finally {
			freeWasm(wPtr, wLen);
		}
	}

	addMember(keyPackageBytes: Uint8Array): AddMemberResult {
		const wasm = getWasm();
		const {ptr: kpPtr, len: kpLen} = passBytes(keyPackageBytes);

		try {
			const res = callWithJsonResult<RawAddMemberJson>((outPtr) =>
				wasm.crypto_group_add_member(this.handle, kpPtr, kpLen, outPtr),
			);
			return {
				commit: new Uint8Array(res.commit),
				welcome: new Uint8Array(res.welcome),
				epoch: BigInt(res.epoch),
			};
		} finally {
			freeWasm(kpPtr, kpLen);
		}
	}

	removeMember(leafIndex: number): Uint8Array {
		const wasm = getWasm();
		return callWithResult((outPtr) => wasm.crypto_group_remove_member(this.handle, leafIndex >>> 0, outPtr));
	}

	encryptMessage(plaintext: Uint8Array): Uint8Array {
		const wasm = getWasm();
		const {ptr: ptPtr, len: ptLen} = passBytes(plaintext);

		try {
			return callWithResult((outPtr) => wasm.crypto_group_encrypt(this.handle, ptPtr, ptLen, outPtr));
		} finally {
			freeWasm(ptPtr, ptLen);
		}
	}

	decryptMessage(ciphertext: Uint8Array): Uint8Array {
		const wasm = getWasm();
		const {ptr: ctPtr, len: ctLen} = passBytes(ciphertext);

		try {
			return callWithResult((outPtr) => wasm.crypto_group_decrypt(this.handle, ctPtr, ctLen, outPtr));
		} finally {
			freeWasm(ctPtr, ctLen);
		}
	}

	processMessage(messageBytes: Uint8Array): ProcessedMessage {
		const wasm = getWasm();
		const {ptr: msgPtr, len: msgLen} = passBytes(messageBytes);

		try {
			const res = callWithJsonResult<RawProcessedMessageJson>((outPtr) =>
				wasm.crypto_group_process_message(this.handle, msgPtr, msgLen, outPtr),
			);

			if (res.kind === 'application') {
				return {
					type: 'application',
					epoch: BigInt(res.epoch ?? 0),
					plaintext: new Uint8Array(res.plaintext ?? []),
				};
			}
			if (res.kind === 'commit') {
				return {
					type: 'commit',
					newEpoch: BigInt(res.epoch ?? 0),
				};
			}
			return {type: 'other'};
		} finally {
			freeWasm(msgPtr, msgLen);
		}
	}

	getEpoch(): bigint {
		const wasm = getWasm();
		return wasm.crypto_group_epoch(this.handle);
	}

	getMembers(): Array<GroupMemberInfo> {
		const wasm = getWasm();
		const rawMembers = callWithJsonResult<Array<RawMemberInfoJson>>((outPtr) =>
			wasm.crypto_group_members(this.handle, outPtr),
		);

		return rawMembers.map((m) => ({
			index: m.index,
			identity: m.identity,
			signatureKey: new Uint8Array(m.signature_key),
			encryptionKey: new Uint8Array(m.encryption_key),
		}));
	}
}
