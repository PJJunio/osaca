// SPDX-License-Identifier: AGPL-3.0-or-later

import path from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({
	root: import.meta.dirname,
	define: {
		'import.meta.env.BUILD_VERSION': JSON.stringify('dev'),
		'import.meta.env.BUILD_CHANNEL': JSON.stringify('development'),
	},
	resolve: {
		alias: {
			'@app': path.resolve(import.meta.dirname, './src'),
			'@osaca/crypto/wasm/osaca_crypto_bg.wasm': path.resolve(
				import.meta.dirname,
				'./src/test/crypto-wasm-url-mock.ts',
			),
			'@osaca/crypto': path.resolve(import.meta.dirname, '../packages/osaca_crypto/src'),
			'@osaca/voice_engine_v2/bridge': path.resolve(import.meta.dirname, '../packages/voice_engine_v2/src/bridge/index.ts'),
			'@osaca/voice_engine_v2/ports': path.resolve(import.meta.dirname, '../packages/voice_engine_v2/src/ports/index.ts'),
			'@osaca': path.resolve(import.meta.dirname, '../packages'),
			'@lingui/core/macro': path.resolve(import.meta.dirname, './src/test/lingui-macro-mock.ts'),
			'@lingui/react/macro': path.resolve(import.meta.dirname, './src/test/lingui-macro-mock.ts'),
			'@pkgs/libfluxcore/libfluxcore': path.resolve(import.meta.dirname, './src/test/libfluxcore-mock.ts'),
			'@pkgs': path.resolve(import.meta.dirname, './pkgs'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		testTimeout: 60000,
		hookTimeout: 60000,
	},
});
