// SPDX-License-Identifier: AGPL-3.0-or-later

import {z} from 'zod';

export const GeoEntry = z.object({
	countryCode: z.string().describe('ISO 3166-1 alpha-2 country code'),
	regionCode: z
		.string()
		.nullable()
		.describe('ISO 3166-2 subdivision code, or null when the entry covers the whole country'),
});

export type GeoEntry = z.infer<typeof GeoEntry>;
