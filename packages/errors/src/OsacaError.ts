// SPDX-License-Identifier: AGPL-3.0-or-later

import type {APIErrorCode} from '@osaca/constants/src/ApiErrorCodes';
import type {ErrorResponse} from '@osaca/schema/src/domains/common/ErrorSchemas';
import {HTTPException} from 'hono/http-exception';

export type OsacaErrorData = Record<string, unknown>;
export type OsacaErrorStatus = HTTPException['status'];

interface OsacaErrorOptions {
	code: string;
	message?: string;
	status: OsacaErrorStatus;
	data?: OsacaErrorData;
	headers?: Record<string, string>;
	messageVariables?: Record<string, unknown>;
	cause?: Error;
}

export class OsacaError extends HTTPException {
	readonly code: string;
	override readonly message: string;
	override readonly status: OsacaErrorStatus;
	readonly data?: OsacaErrorData;
	readonly headers?: Record<string, string>;
	readonly messageVariables?: Record<string, unknown>;

	constructor(options: OsacaErrorOptions) {
		const resolvedMessage = options.message ?? options.code;
		super(options.status, {message: resolvedMessage, cause: options.cause});
		this.code = options.code;
		this.message = resolvedMessage;
		this.status = options.status;
		this.data = options.data;
		this.headers = options.headers;
		this.messageVariables = options.messageVariables;
		this.name = 'OsacaError';
	}

	override getResponse(): Response {
		return new Response(JSON.stringify(this.toJSON()), {
			status: this.status,
			headers: {
				'Content-Type': 'application/json',
				...this.headers,
			},
		});
	}

	toJSON(): ErrorResponse {
		return {
			code: this.code,
			message: this.message,
			...this.data,
		};
	}
}

type StatusErrorOptions = Omit<OsacaErrorOptions, 'status' | 'code'>;
type RequiredStatusErrorOptions<TAllowMessage extends boolean> = {code: APIErrorCode} & (TAllowMessage extends true
	? StatusErrorOptions
	: Omit<StatusErrorOptions, 'message'>);

export function statusError<TAllowMessage extends boolean = true>(
	status: OsacaErrorStatus,
	allowMessage: TAllowMessage = true as TAllowMessage,
) {
	return class extends OsacaError {
		constructor(options: RequiredStatusErrorOptions<TAllowMessage>) {
			const {message, ...rest} = options as StatusErrorOptions & {code: APIErrorCode};
			super({...rest, status, message: allowMessage ? message : undefined});
		}
	};
}

export function defaultCodeStatusError<TCode extends string = APIErrorCode>(
	status: OsacaErrorStatus,
	defaultCode: NoInfer<TCode>,
) {
	return class extends OsacaError {
		constructor({code = defaultCode, ...options}: StatusErrorOptions & {code?: TCode} = {}) {
			super({...options, code, status});
		}
	};
}
