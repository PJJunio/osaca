// SPDX-License-Identifier: AGPL-3.0-or-later

import {UserPrivateResponse} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {SnowflakeStringType} from '@osaca/schema/src/primitives/SchemaPrimitives';
import {PasswordType} from '@osaca/schema/src/primitives/UserValidators';
import {z} from 'zod';

export const GuildEntryResult = z
	.object({
		guild_id: SnowflakeStringType.describe('ID of the community the account entered'),
		mode: z.enum(['visit', 'member']).describe('Whether the account visits the community or became a member'),
	})
	.describe('Community the account entered after sign-up');

export type GuildEntryResult = z.infer<typeof GuildEntryResult>;

export const ClaimAccountRequest = z.object({
	password: PasswordType.describe('Password that lets the account sign in from other devices'),
});

export type ClaimAccountRequest = z.infer<typeof ClaimAccountRequest>;

export const ClaimAccountResponse = z.object({
	user: UserPrivateResponse,
});

export type ClaimAccountResponse = z.infer<typeof ClaimAccountResponse>;
