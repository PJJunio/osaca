// SPDX-License-Identifier: AGPL-3.0-or-later

import {HttpError} from '@app/features/platform/types/EndpointError';
import {isObjectLike as isRecord} from '@osaca/record_utils/src/RecordGuards';

const NON_CONTEXT_KEYS = new Set(['code', 'details', 'errors', 'message', 'request_id', 'retry_after', 'status']);

interface ValidationFault {
	path: string;
	code?: string;
	message: string;
}

interface ApiErrorResponse {
	status: number | undefined;
	code: string | undefined;
	message: string | undefined;
	requestId: string | undefined;
	fields: ReadonlyArray<ValidationFault> | undefined;
	retryAfterSeconds: number | undefined;
	context: Record<string, unknown> | undefined;
}

function parseAPIErrorResponse(body: unknown, httpStatus?: number): ApiErrorResponse | null {
	if (!isRecord(body)) return null;
	const details = isRecord(body.details) ? body.details : undefined;
	const retry = details != null && isRecord(details.retry) ? details.retry : undefined;
	return {
		status: httpStatus ?? readNumber(body, 'status'),
		code: readString(body, 'code'),
		message: readString(body, 'message'),
		requestId: readString(body, 'request_id'),
		fields: readValidationFaults(details?.fields) ?? readValidationFaults(body.errors),
		retryAfterSeconds: readNumber(retry, 'after_seconds') ?? readNumber(body, 'retry_after'),
		context: readErrorContext(body, details),
	};
}

export function replyCode(body: unknown): string | undefined {
	return parseAPIErrorResponse(body)?.code;
}

export function failureCode(error: unknown): string | undefined {
	return failureResponse(error)?.code;
}

export function failureMessage(error: unknown): string | undefined {
	return failureResponse(error)?.message;
}

export function failureContext(error: unknown): Record<string, unknown> | undefined {
	return failureResponse(error)?.context;
}

export function failureRetryAfterSeconds(error: unknown): number | undefined {
	return failureResponse(error)?.retryAfterSeconds;
}

export function failureValidationErrors(error: unknown): ReadonlyArray<ValidationFault> | undefined {
	return failureResponse(error)?.fields;
}

function failureResponse(error: unknown): ApiErrorResponse | null {
	return error instanceof HttpError ? parseAPIErrorResponse(error.body, error.status) : null;
}

function readErrorContext(
	body: Record<string, unknown>,
	details: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (details != null && isRecord(details.context)) return details.context;
	const context: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(body)) {
		if (NON_CONTEXT_KEYS.has(key)) continue;
		context[key] = value;
	}
	return Object.keys(context).length > 0 ? context : undefined;
}

function readValidationFaults(value: unknown): ReadonlyArray<ValidationFault> | undefined {
	if (!Array.isArray(value)) return undefined;
	const faults: Array<ValidationFault> = [];
	for (const entry of value) {
		const path = readString(entry, 'path');
		const message = readString(entry, 'message');
		if (path == null || message == null) continue;
		const code = readString(entry, 'code');
		faults.push(code == null ? {path, message} : {path, code, message});
	}
	return faults.length > 0 ? faults : undefined;
}

function readString(value: unknown, key: string): string | undefined {
	if (!isRecord(value)) return undefined;
	const found = value[key];
	return typeof found === 'string' ? found : undefined;
}

function readNumber(value: unknown, key: string): number | undefined {
	if (!isRecord(value)) return undefined;
	const found = value[key];
	return typeof found === 'number' ? found : undefined;
}
