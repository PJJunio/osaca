// SPDX-License-Identifier: AGPL-3.0-or-later

import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {InitOutput} from '../wasm/osaca_crypto.js';
import initWasm, {initSync} from '../wasm/osaca_crypto.js';

let wasmInstance: InitOutput | null = null;
const RESULT_HEADER_BYTES = 16;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', {fatal: false});

export function ensureCryptoWasmReady(): InitOutput {
	if (wasmInstance) {
		return wasmInstance;
	}

	const currentDir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url));
	const wasmPath = join(currentDir, '../wasm/osaca_crypto_bg.wasm');
	const wasmBytes = readFileSync(wasmPath);

	wasmInstance = initSync({module: wasmBytes});
	return wasmInstance;
}

export async function initCryptoWasm(moduleOrPath?: Parameters<typeof initWasm>[0]): Promise<InitOutput> {
	if (wasmInstance) {
		return wasmInstance;
	}
	if (!moduleOrPath) {
		return ensureCryptoWasmReady();
	}
	wasmInstance = await initWasm(moduleOrPath);
	return wasmInstance;
}

export function getWasm(): InitOutput {
	if (!wasmInstance) {
		return ensureCryptoWasmReady();
	}
	return wasmInstance;
}

export function allocWasm(len: number): number {
	if (len === 0) return 0;
	const wasm = getWasm();
	const ptr = wasm.crypto_alloc(len >>> 0);
	if (ptr === 0) {
		throw new Error('osaca_crypto wasm allocation failed');
	}
	return ptr >>> 0;
}

export function freeWasm(ptr: number, len: number): void {
	if (ptr !== 0 && len !== 0) {
		getWasm().crypto_free(ptr >>> 0, len >>> 0);
	}
}

export function passBytes(bytes: Uint8Array): {ptr: number; len: number} {
	if (bytes.byteLength === 0) {
		return {ptr: 0, len: 0};
	}
	const ptr = allocWasm(bytes.byteLength);
	const memory = new Uint8Array(getWasm().memory.buffer);
	memory.set(bytes, ptr);
	return {ptr, len: bytes.byteLength};
}

export function passString(value: string): {ptr: number; len: number} {
	if (!value) {
		return {ptr: 0, len: 0};
	}
	const bytes = textEncoder.encode(value);
	return passBytes(bytes);
}

export function callWithResult(fn: (outPtr: number) => number): Uint8Array {
	const wasm = getWasm();
	const outPtr = allocWasm(RESULT_HEADER_BYTES);

	try {
		const code = fn(outPtr);
		const header = new DataView(wasm.memory.buffer, outPtr, RESULT_HEADER_BYTES);
		const dataPtr = header.getUint32(0, true);
		const dataLen = header.getUint32(4, true);
		const errPtr = header.getUint32(8, true);
		const errLen = header.getUint32(12, true);

		if (errLen > 0) {
			const errBytes = new Uint8Array(wasm.memory.buffer, errPtr, errLen);
			const errMsg = textDecoder.decode(errBytes);
			freeWasm(errPtr, errLen);
			throw new Error(`osaca_crypto error: ${errMsg}`);
		}

		if (code !== 0 && dataLen === 0) {
			throw new Error(`osaca_crypto call failed with status code ${code}`);
		}

		if (dataLen === 0) {
			return new Uint8Array(0);
		}

		const dataCopy = new Uint8Array(dataLen);
		dataCopy.set(new Uint8Array(wasm.memory.buffer, dataPtr, dataLen));
		freeWasm(dataPtr, dataLen);
		return dataCopy;
	} finally {
		freeWasm(outPtr, RESULT_HEADER_BYTES);
	}
}

export function callWithJsonResult<T>(fn: (outPtr: number) => number): T {
	const bytes = callWithResult(fn);
	const jsonStr = textDecoder.decode(bytes);
	return JSON.parse(jsonStr) as T;
}
