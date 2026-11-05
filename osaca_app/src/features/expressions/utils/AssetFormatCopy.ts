// SPDX-License-Identifier: AGPL-3.0-or-later

import {formatFileSize} from '@app/features/messaging/utils/FileUtils';
import {ASSET_FORMAT_POLICY, type AssetKind} from '@osaca/constants/src/AssetFormatPolicy';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

const UNSUPPORTED_FILE_TYPE_ALLOWED_FORMATS_DESCRIPTOR = msg({
	message: 'Unsupported file type.',
	comment: 'Form validation error for an asset of an unsupported file type.',
});
const FILE_IS_TOO_LARGE_MAXIMUM_SIZE_IS_DESCRIPTOR = msg({
	message: 'File is too large. Maximum size is {maxSize}.',
	comment: 'Form validation error for an asset that exceeds the maximum file size.',
});
const IMAGE_DIMENSIONS_ARE_OUT_OF_RANGE_DESCRIPTOR = msg({
	message: 'Image dimensions are out of range.',
	comment: 'Form validation error for an asset image with invalid dimensions.',
});
const IMAGE_DIMENSIONS_MUST_BE_BETWEEN_X_AND_X_DESCRIPTOR = msg({
	message: 'Image dimensions must be between {min}x{min2} and {max}x{max2} pixels.',
	comment: 'Form validation error describing valid asset image dimensions.',
});
export type AssetCopyErrorReason = 'unsupported_mime' | 'too_large' | 'bad_dimensions';

export function getAssetFormatErrorMessage(i18n: I18n, kind: AssetKind, reason: AssetCopyErrorReason): string {
	const policy = ASSET_FORMAT_POLICY[kind];
	switch (reason) {
		case 'unsupported_mime': {
			return i18n._(UNSUPPORTED_FILE_TYPE_ALLOWED_FORMATS_DESCRIPTOR);
		}
		case 'too_large': {
			const maxSize = formatFileSize(i18n.locale, policy.maxBytes);
			return i18n._(FILE_IS_TOO_LARGE_MAXIMUM_SIZE_IS_DESCRIPTOR, {maxSize});
		}
		case 'bad_dimensions': {
			if (policy.dims == null) {
				return i18n._(IMAGE_DIMENSIONS_ARE_OUT_OF_RANGE_DESCRIPTOR);
			}
			const min = policy.dims.min;
			const max = policy.dims.max;
			return i18n._(IMAGE_DIMENSIONS_MUST_BE_BETWEEN_X_AND_X_DESCRIPTOR, {min, min2: min, max, max2: max});
		}
	}
}
