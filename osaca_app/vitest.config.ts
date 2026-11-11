// SPDX-License-Identifier: AGPL-3.0-or-later

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {defineConfig, type Plugin} from 'vitest/config';

const SVG_REACT_PREFIX = '\0svg-react:';

/** Stands in for svgr: `import Logo from './logo.svg?react'` renders the file's real markup. */
function svgReactComponents(): Plugin {
	return {
		name: 'osaca-test-svg-react',
		enforce: 'pre',
		async resolveId(source, importer) {
			if (!source.endsWith('.svg?react')) return null;
			const resolved = await this.resolve(source.slice(0, -'?react'.length), importer, {skipSelf: true});
			return resolved ? `${SVG_REACT_PREFIX}${resolved.id}` : null;
		},
		load(id) {
			if (!id.startsWith(SVG_REACT_PREFIX)) return null;
			const markup = readFileSync(id.slice(SVG_REACT_PREFIX.length), 'utf8');
			const viewBox = markup.match(/<svg\b[^>]*\bviewBox="([^"]*)"/)?.[1];
			const inner = markup.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '');
			return `import {createElement} from 'react';
export default (props) => createElement('svg', {xmlns: 'http://www.w3.org/2000/svg', viewBox: ${JSON.stringify(viewBox)}, ...props, dangerouslySetInnerHTML: {__html: ${JSON.stringify(inner)}}});`;
		},
	};
}

export default defineConfig({
	root: import.meta.dirname,
	plugins: [svgReactComponents()],
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
			'@osaca/voice_engine_v2/bridge': path.resolve(
				import.meta.dirname,
				'../packages/voice_engine_v2/src/bridge/index.ts',
			),
			'@osaca/voice_engine_v2/ports': path.resolve(
				import.meta.dirname,
				'../packages/voice_engine_v2/src/ports/index.ts',
			),
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
