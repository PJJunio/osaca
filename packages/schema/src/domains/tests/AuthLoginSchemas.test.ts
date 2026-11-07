// SPDX-License-Identifier: AGPL-3.0-or-later

import {LoginRequest} from '@osaca/schema/src/domains/auth/AuthSchemas';
import {describe, expect, it} from 'vitest';

const password = 'correct horse battery';

describe('LoginRequest', () => {
	it('accepts a login and password', () => {
		expect(LoginRequest.parse({login: 'person', password})).toEqual({login: 'person', password});
	});

	it('drops an email sent by an old client', () => {
		expect(LoginRequest.parse({email: 'person@example.com', login: 'person', password})).toEqual({
			login: 'person',
			password,
		});
	});

	it.each([{}, {password}, {login: 'person'}, {login: '', password}, {login: null, password}])('rejects %j', (body) => {
		expect(LoginRequest.safeParse(body).success).toBe(false);
	});

	it('reports only the type error for a body that is not an object', () => {
		const result = LoginRequest.safeParse('nope');
		expect(result.error?.issues).toEqual([expect.objectContaining({path: [], code: 'invalid_type'})]);
	});
});
