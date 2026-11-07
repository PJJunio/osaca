/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const crypto_alloc: (a: number) => number;
export const crypto_device_create: (a: number, b: number, c: number, d: number, e: number) => number;
export const crypto_device_generate_key_package: (a: bigint, b: number) => number;
export const crypto_free: (a: number, b: number) => void;
export const crypto_group_add_member: (a: bigint, b: number, c: number, d: number) => number;
export const crypto_group_create: (a: bigint, b: number, c: number, d: number) => number;
export const crypto_group_decrypt: (a: bigint, b: number, c: number, d: number) => number;
export const crypto_group_encrypt: (a: bigint, b: number, c: number, d: number) => number;
export const crypto_group_epoch: (a: bigint) => bigint;
export const crypto_group_join_welcome: (a: bigint, b: number, c: number, d: number) => number;
export const crypto_group_members: (a: bigint, b: number) => number;
export const crypto_group_process_message: (a: bigint, b: number, c: number, d: number) => number;
export const crypto_group_remove_member: (a: bigint, b: number, c: number) => number;
export const crypto_identity_from_seed: (a: number, b: number, c: number, d: number, e: number) => number;
export const crypto_identity_generate: (a: number, b: number, c: number) => number;
export const crypto_recovery_decrypt: (a: number, b: number, c: number, d: number, e: number) => number;
export const crypto_recovery_encrypt: (a: number, b: number, c: number, d: number, e: number) => number;
export const crypto_recovery_secret_generate: (a: number) => number;
export const __wbindgen_export: (a: number) => void;
export const __wbindgen_export2: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_start: () => void;
