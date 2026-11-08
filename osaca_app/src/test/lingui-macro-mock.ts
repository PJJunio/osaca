// SPDX-License-Identifier: AGPL-3.0-or-later

import type React from 'react';

export function msg(descriptor: unknown): unknown {
	return descriptor;
}

export function defineMessage(descriptor: unknown): unknown {
	return descriptor;
}

export const Trans: React.FC<{children?: React.ReactNode}> = ({children}) => children as React.ReactElement;

export function useLingui(): {
	i18n: {
		_: (descriptor: unknown, values?: Record<string, unknown>) => string;
		locale: string;
	};
} {
	return {
		i18n: {
			_: (descriptor: unknown, values?: Record<string, unknown>) => {
				if (typeof descriptor === 'string') return descriptor;
				const desc = descriptor as {message?: string; id?: string};
				let str = desc?.message ?? desc?.id ?? '';
				if (values) {
					for (const [k, v] of Object.entries(values)) {
						str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
					}
				}
				return str;
			},
			locale: 'en',
		},
	};
}
