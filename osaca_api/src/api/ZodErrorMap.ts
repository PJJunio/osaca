// SPDX-License-Identifier: AGPL-3.0-or-later

import type {ValidationErrorCode} from '@osaca/constants/src/ValidationErrorCodes';
import {isValidationErrorCode, ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {z} from 'zod';

const osacaZodErrorMap: z.core.$ZodErrorMap = (issue) => {
	if (issue.message && isValidationErrorCode(issue.message)) {
		return {message: issue.message};
	}
	let errorCode: ValidationErrorCode;
	switch (issue.code) {
		case 'invalid_type': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		case 'unrecognized_keys': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		case 'invalid_union': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		case 'invalid_value': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		case 'too_small': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		case 'too_big': {
			if (issue.origin === 'string') {
				errorCode = ValidationErrorCodes.CONTENT_EXCEEDS_MAX_LENGTH;
			} else {
				errorCode = ValidationErrorCodes.INVALID_FORMAT;
			}
			break;
		}
		case 'invalid_format': {
			if (issue.format === 'email') {
				errorCode = ValidationErrorCodes.INVALID_EMAIL_ADDRESS;
			} else if (issue.format === 'uuid') {
				errorCode = ValidationErrorCodes.INVALID_SNOWFLAKE;
			} else {
				errorCode = ValidationErrorCodes.INVALID_FORMAT;
			}
			break;
		}
		case 'not_multiple_of': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		case 'custom': {
			const customErrorCode = issue.params?.['error_code'];
			errorCode =
				typeof customErrorCode === 'string' && isValidationErrorCode(customErrorCode)
					? customErrorCode
					: ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		case 'invalid_key':
		case 'invalid_element': {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
		default: {
			errorCode = ValidationErrorCodes.INVALID_FORMAT;
			break;
		}
	}
	return {message: errorCode};
};

export function initializeOsacaErrorMap(): void {
	z.config({customError: osacaZodErrorMap});
}
