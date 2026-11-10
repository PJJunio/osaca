// SPDX-License-Identifier: AGPL-3.0-or-later

import {defineConfig, fontProviders} from 'astro/config';

const fontsource = fontProviders.fontsource();

export default defineConfig({
	output: 'static',
	devToolbar: {
		enabled: false,
	},
	fonts: [
		{
			cssVariable: '--font-inter',
			fallbacks: ['system-ui', 'sans-serif'],
			name: 'Inter',
			provider: fontsource,
			styles: ['normal'],
			subsets: ['latin', 'latin-ext'],
			weights: ['400 700'],
		},
		{
			cssVariable: '--font-montserrat',
			fallbacks: ['system-ui', 'sans-serif'],
			name: 'Montserrat',
			provider: fontsource,
			styles: ['normal'],
			subsets: ['latin', 'latin-ext'],
			weights: ['600 800'],
		},
	],
});
