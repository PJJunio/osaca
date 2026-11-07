/* tslint:disable */
/* eslint-disable */

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly crypto_alloc: (a: number) => number;
    readonly crypto_device_create: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly crypto_device_generate_key_package: (a: bigint, b: number) => number;
    readonly crypto_free: (a: number, b: number) => void;
    readonly crypto_group_add_member: (a: bigint, b: number, c: number, d: number) => number;
    readonly crypto_group_create: (a: bigint, b: number, c: number, d: number) => number;
    readonly crypto_group_decrypt: (a: bigint, b: number, c: number, d: number) => number;
    readonly crypto_group_encrypt: (a: bigint, b: number, c: number, d: number) => number;
    readonly crypto_group_epoch: (a: bigint) => bigint;
    readonly crypto_group_join_welcome: (a: bigint, b: number, c: number, d: number) => number;
    readonly crypto_group_members: (a: bigint, b: number) => number;
    readonly crypto_group_process_message: (a: bigint, b: number, c: number, d: number) => number;
    readonly crypto_group_remove_member: (a: bigint, b: number, c: number) => number;
    readonly crypto_identity_from_seed: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly crypto_identity_generate: (a: number, b: number, c: number) => number;
    readonly crypto_recovery_decrypt: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly crypto_recovery_encrypt: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly crypto_recovery_secret_generate: (a: number) => number;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_export2: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
