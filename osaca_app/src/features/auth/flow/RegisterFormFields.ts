// SPDX-License-Identifier: AGPL-3.0-or-later

export interface RegisterFormFields {
	showPassword?: boolean;
	showPasswordConfirmation?: boolean;
	showUsername?: boolean;
	showUsernameValidation?: boolean;
	requireUsername?: boolean;
}

export function credentialRegisterFields(): RegisterFormFields {
	return {
		showPassword: true,
		showPasswordConfirmation: true,
		showUsernameValidation: true,
		requireUsername: true,
	};
}

export function readRegistrationUrlCode(params: URLSearchParams): string | undefined {
	return params.get('registration_url')?.trim() || undefined;
}
