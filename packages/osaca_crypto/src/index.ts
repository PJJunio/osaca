// SPDX-License-Identifier: AGPL-3.0-or-later

export {
	AttachmentDigestMismatchError,
	base64ToUint8Array,
	computeSha256Hex,
	decryptAttachmentBytes,
	type EncryptedAttachmentResult,
	encryptAttachmentBytes,
	hexToUint8Array,
	uint8ArrayToBase64,
	uint8ArrayToHex,
} from './attachment.js';
export {DeviceSession, MlsGroupSession} from './group.js';
export {IdentityKey} from './identity.js';
export {RecoveryKit} from './recovery.js';
export {
	deriveSafetyNumber,
	formatSafetyNumberDigits,
	parseSafetyNumberDigits,
	type SafetyNumber,
	type SafetyNumberParticipant,
	type SafetyNumberQrPayload,
	verifySafetyNumberQr,
} from './safety_number.js';
export {
	MemoryTofuStorage,
	type TofuContactRecord,
	TofuIdentityStore,
	type TofuRecordStatus,
	type TofuStorage,
} from './tofu.js';
export type {
	AccountKeyBundle,
	AddMemberResult,
	GroupMemberInfo,
	IdentityKeyData,
	ProcessedMessage,
} from './types.js';
export {ensureCryptoWasmReady, initCryptoWasm} from './wasm.js';
