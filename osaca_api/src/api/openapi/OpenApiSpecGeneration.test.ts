// SPDX-License-Identifier: AGPL-3.0-or-later

// Both OpenAPI documents must generate and validate from the controllers (issue #59). A controller that declares
// a schema inline instead of as a named export breaks generation, which is how the public spec broke unnoticed,
// and a committed document that nobody regenerates drifts from the routes. Regenerate with
// `npx tsx src/scripts/GenerateSpec.ts` in packages/openapi.

import path from 'node:path';
import {OpenAPIGenerator} from '@osaca/openapi/src/OpenAPIGenerator';
import {validateSpec} from '@osaca/openapi/src/output/SpecValidator';
import {getAdminOutputPath, getApiPackageOutputPath, readSpec} from '@osaca/openapi/src/output/SpecWriter';
import {describe, expect, test} from 'vitest';

const repositoryRoot = path.resolve(import.meta.dirname, '../../../..');

describe.each([
	{
		target: 'public' as const,
		schemaTarget: 'draft-2020-12' as const,
		version: '3.1.0',
		committed: getApiPackageOutputPath,
	},
	{target: 'admin' as const, schemaTarget: 'openapi-3.0' as const, version: '3.0.3', committed: getAdminOutputPath},
])('the $target OpenAPI document', ({target, schemaTarget, version, committed}) => {
	test('generates from the controllers, validates and matches the committed document', {timeout: 180_000}, async () => {
		const generator = new OpenAPIGenerator({
			basePath: repositoryRoot,
			title: 'OSACA API',
			version: '1.0.0',
			description: 'OSACA API',
			serverUrl: 'https://api.osaca.example/v1',
			routeScope: target,
			schemaTarget,
		});

		const {document} = await generator.generateWithStats();
		const result = await validateSpec(document, {allowedOpenAPIVersions: [version]});

		expect(result.valid).toBe(true);
		expect(Object.keys(document.paths).length).toBeGreaterThan(0);
		const saved = readSpec(committed(repositoryRoot)) as Pick<typeof document, 'paths' | 'components'>;
		const generated = JSON.parse(JSON.stringify({paths: document.paths, components: document.components}));
		expect(generated).toEqual({paths: saved.paths, components: saved.components});
	});
});
