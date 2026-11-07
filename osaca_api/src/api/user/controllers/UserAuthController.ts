// SPDX-License-Identifier: AGPL-3.0-or-later

import {createRecoveryKit, getRecoveryKitStatus} from '@app/api/auth/AuthRecoveryKit';
import {
	completePasskeyMigration,
	getPasskeyMigration,
	getPasskeyMigrationRegistrationOptions,
} from '@app/api/auth/services/PasskeyMigrationService';
import {requireSudoMode} from '@app/api/auth/services/SudoVerificationService';
import {DefaultUserOnly, LoginRequired} from '@app/api/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@app/api/middleware/RateLimitMiddleware';
import {OpenAPI} from '@app/api/middleware/ResponseTypeMiddleware';
import {SudoModeMiddleware} from '@app/api/middleware/SudoModeMiddleware';
import {RateLimitConfigs} from '@app/api/RateLimitConfig';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {assertValidTotpSetupCode} from '@app/api/user/services/UserAuth';
import {Validator} from '@app/api/Validator';
import {
	DisableTotpRequest,
	EnableMfaTotpRequest,
	MfaBackupCodesRequest,
	MfaBackupCodesResponse,
	SudoMfaMethodsResponse,
	SudoVerificationSchema,
	WebAuthnChallengeResponse,
	WebAuthnCredentialListResponse,
	WebAuthnCredentialUpdateRequest,
	WebAuthnRegisterRequest,
	WebAuthnTwoFactorRequest,
	WebAuthnTwoFactorResponse,
} from '@osaca/schema/src/domains/auth/AuthSchemas';
import {
	PasskeyMigrationCompleteRequest,
	PasskeyMigrationResponse,
} from '@osaca/schema/src/domains/auth/PasskeyMigrationSchemas';
import {CredentialIdParam} from '@osaca/schema/src/domains/common/CommonParamSchemas';
import {RecoveryKitCreateResponse, RecoveryKitStatusResponse} from '@osaca/schema/src/domains/user/UserResponseSchemas';

export function UserAuthController(app: HonoApp) {
	app.post(
		'/users/@me/mfa/totp/enable',
		RateLimitMiddleware(RateLimitConfigs.USER_MFA_TOTP_ENABLE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', EnableMfaTotpRequest),
		OpenAPI({
			operationId: 'enable_totp_mfa',
			summary: 'Enable TOTP multi-factor authentication',
			responseSchema: MfaBackupCodesResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Enable time-based one-time password (TOTP) MFA on the current account. Returns backup codes for account recovery. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');
			await assertValidTotpSetupCode(body.secret, body.code);
			const sudoResult = await requireSudoMode(ctx, user, body);
			return ctx.json(
				await ctx.get('userAuthRequestService').enableTotp({
					user,
					data: body,
					sudoContext: sudoResult,
				}),
			);
		},
	);
	app.post(
		'/users/@me/mfa/totp/disable',
		RateLimitMiddleware(RateLimitConfigs.USER_MFA_TOTP_DISABLE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', DisableTotpRequest),
		OpenAPI({
			operationId: 'disable_totp_mfa',
			summary: 'Disable TOTP multi-factor authentication',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Disable TOTP multi-factor authentication on the current account. Requires sudo mode verification for security.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');
			const sudoBody =
				body.mfa_method || !user.totpSecret ? body : {...body, mfa_method: 'totp' as const, mfa_code: body.code};
			const sudoResult = await requireSudoMode(ctx, user, sudoBody);
			await ctx.get('userAuthRequestService').disableTotp({user, data: body, sudoContext: sudoResult});
			return ctx.body(null, 204);
		},
	);
	app.post(
		'/users/@me/mfa/backup-codes',
		RateLimitMiddleware(RateLimitConfigs.USER_MFA_BACKUP_CODES),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', MfaBackupCodesRequest),
		OpenAPI({
			operationId: 'get_backup_codes_mfa',
			summary: 'Get backup codes for multi-factor authentication',
			responseSchema: MfaBackupCodesResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Generate and retrieve new backup codes for account recovery. Requires sudo mode verification. Old codes are invalidated.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');
			const sudoResult = await requireSudoMode(ctx, user, body);
			return ctx.json(
				await ctx.get('userAuthRequestService').getBackupCodes({user, data: body, sudoContext: sudoResult}),
			);
		},
	);
	app.get(
		'/users/@me/recovery-kit',
		RateLimitMiddleware(RateLimitConfigs.USER_RECOVERY_KIT_GET),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_recovery_kit_status',
			summary: 'Get recovery kit status',
			responseSchema: RecoveryKitStatusResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Check whether the current account has a recovery kit and when it was created.. The recovery key itself is never returned here.',
		}),
		async (ctx) => {
			return ctx.json(await getRecoveryKitStatus(ctx.get('user').id));
		},
	);
	app.post(
		'/users/@me/recovery-kit',
		RateLimitMiddleware(RateLimitConfigs.USER_RECOVERY_KIT_CREATE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'create_recovery_kit',
			summary: 'Create recovery kit',
			responseSchema: RecoveryKitCreateResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Create a recovery kit for the current account and return its recovery key. The key is shown only once and any previous kit stops working.. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			await requireSudoMode(ctx, user, ctx.req.valid('json'));
			return ctx.json(await createRecoveryKit(user.id));
		},
	);
	app.delete(
		'/users/@me/authorized-ips',
		RateLimitMiddleware(RateLimitConfigs.USER_AUTHORIZED_IPS_FORGET),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'forget_authorized_ips',
			summary: 'Forget authorized IPs for current user',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Clears all authorized IP addresses for the current user. After calling this endpoint, the user will be required to re-authorize any new IP addresses they log in from. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body);
			await ctx.get('userAuthRequestService').forgetAuthorizedIps(user);
			return ctx.body(null, 204);
		},
	);
	app.get(
		'/users/@me/mfa/webauthn/credentials',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_LIST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_webauthn_credentials',
			summary: 'List WebAuthn credentials',
			responseSchema: WebAuthnCredentialListResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieve all registered WebAuthn credentials (security keys, biometric devices) for the current user. Requires authentication.',
		}),
		async (ctx) => {
			return ctx.json(await ctx.get('userAuthRequestService').listWebAuthnCredentials(ctx.get('user')));
		},
	);
	app.post(
		'/users/@me/mfa/webauthn/credentials/registration-options',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_REGISTRATION_OPTIONS),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'get_webauthn_registration_options',
			summary: 'Get WebAuthn registration options',
			responseSchema: WebAuthnChallengeResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Generate challenge and options to register a new WebAuthn credential. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, {
				issueSudoToken: false,
			});
			return ctx.json(
				await ctx.get('userAuthRequestService').generateWebAuthnRegistrationOptions(user, ctx.req.header('origin')),
			);
		},
	);
	app.post(
		'/users/@me/mfa/webauthn/credentials',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_REGISTER),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', WebAuthnRegisterRequest),
		OpenAPI({
			operationId: 'register_webauthn_credential',
			summary: 'Register WebAuthn credential',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Complete registration of a new WebAuthn credential (security key or biometric device) using a challenge created after sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await ctx.get('userAuthRequestService').registerWebAuthnCredential({
				user,
				data: body,
			});
			return ctx.body(null, 204);
		},
	);
	app.patch(
		'/users/@me/mfa/webauthn/credentials/:credential_id',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', CredentialIdParam),
		Validator('json', WebAuthnCredentialUpdateRequest),
		SudoModeMiddleware,
		OpenAPI({
			operationId: 'update_webauthn_credential',
			summary: 'Update WebAuthn credential',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description: 'Update the name or settings of a registered WebAuthn credential. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {credential_id} = ctx.req.valid('param');
			const {name, ...sudoBody} = ctx.req.valid('json');
			await requireSudoMode(ctx, user, sudoBody);
			await ctx.get('userAuthRequestService').renameWebAuthnCredential({
				user,
				credentialId: credential_id,
				data: {name},
			});
			return ctx.body(null, 204);
		},
	);
	app.delete(
		'/users/@me/mfa/webauthn/credentials/:credential_id',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_DELETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', CredentialIdParam),
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'delete_webauthn_credential',
			summary: 'Delete WebAuthn credential',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Remove a registered WebAuthn credential from the current account. Requires sudo mode verification for security.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {credential_id} = ctx.req.valid('param');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body);
			await ctx.get('userAuthRequestService').deleteWebAuthnCredential({user, credentialId: credential_id});
			return ctx.body(null, 204);
		},
	);
	app.get(
		'/users/@me/mfa/webauthn/migration',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_MIGRATION),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_webauthn_migration',
			summary: 'Get pending passkey update',
			responseSchema: PasskeyMigrationResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Return the passkey this session can update to the new domain after using it within the last five minutes, or null.',
		}),
		async (ctx) => {
			return ctx.json(await getPasskeyMigration(ctx.get('apiContext'), ctx.get('user').id, ctx.get('authSession')));
		},
	);
	app.post(
		'/users/@me/mfa/webauthn/migration/registration-options',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_MIGRATION),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_webauthn_migration_registration_options',
			summary: 'Get passkey update registration options',
			responseSchema: WebAuthnChallengeResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Generate registration options for the passkey that replaces the pending one. Requires a pending passkey update for this session.',
		}),
		async (ctx) => {
			return ctx.json(
				await getPasskeyMigrationRegistrationOptions(
					ctx.get('apiContext'),
					ctx.get('user').id,
					ctx.get('authSession'),
					ctx.req.header('origin'),
				),
			);
		},
	);
	app.post(
		'/users/@me/mfa/webauthn/migration',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_MIGRATION),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', PasskeyMigrationCompleteRequest),
		OpenAPI({
			operationId: 'complete_webauthn_migration',
			summary: 'Complete passkey update',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Register the replacement passkey under the name of the pending one. The old passkey stops appearing in lists and is removed together with its replacement.',
		}),
		async (ctx) => {
			await completePasskeyMigration(
				ctx.get('apiContext'),
				ctx.get('user').id,
				ctx.get('authSession'),
				ctx.req.header('origin'),
				ctx.req.valid('json'),
			);
			return ctx.body(null, 204);
		},
	);
	app.put(
		'/users/@me/mfa/webauthn/two-factor',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_TWO_FACTOR),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', WebAuthnTwoFactorRequest),
		OpenAPI({
			operationId: 'set_webauthn_two_factor',
			summary: 'Set WebAuthn two-factor authentication',
			responseSchema: WebAuthnTwoFactorResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Choose whether registered passkeys are required as a second factor when signing in with a password. Enabling requires at least one registered credential and mints backup codes when the account has none. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body);
			return ctx.json(await ctx.get('userAuthRequestService').setWebAuthnTwoFactor({user, data: body}));
		},
	);
	app.get(
		'/users/@me/sudo/mfa-methods',
		RateLimitMiddleware(RateLimitConfigs.SUDO_MFA_METHODS),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_sudo_mfa_methods',
			summary: 'List sudo multi-factor authentication methods',
			responseSchema: SudoMfaMethodsResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieve all available MFA methods for sudo mode verification (TOTP, WebAuthn). Requires authentication.',
		}),
		async (ctx) => {
			return ctx.json(await ctx.get('userAuthRequestService').listSudoMfaMethods(ctx.get('user')));
		},
	);
	app.post(
		'/users/@me/sudo/webauthn/authentication-options',
		RateLimitMiddleware(RateLimitConfigs.SUDO_WEBAUTHN_OPTIONS),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_sudo_webauthn_authentication_options',
			summary: 'Get sudo WebAuthn authentication options',
			responseSchema: WebAuthnChallengeResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Generate WebAuthn challenge for sudo mode verification using a registered security key or biometric device.',
		}),
		async (ctx) => {
			return ctx.json(
				await ctx.get('userAuthRequestService').getSudoWebAuthnOptions(ctx.get('user'), ctx.req.header('origin')),
			);
		},
	);
}
