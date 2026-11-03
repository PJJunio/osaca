// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import type {ThreadDenial} from '@osaca/constants/src/ThreadPermissionUtils';
import {ThreadArchivedError} from '@osaca/errors/src/domains/channel/ThreadArchivedError';
import {ThreadLockedError} from '@osaca/errors/src/domains/channel/ThreadLockedError';
import {UnknownThreadMemberError} from '@osaca/errors/src/domains/channel/UnknownThreadMemberError';
import {MissingAccessError} from '@osaca/errors/src/domains/core/MissingAccessError';
import {MissingPermissionsError} from '@osaca/errors/src/domains/core/MissingPermissionsError';
import {CommunicationDisabledError} from '@osaca/errors/src/domains/moderation/CommunicationDisabledError';

function threadDenialError(denial: ThreadDenial): Error {
	switch (denial) {
		case APIErrorCodes.MISSING_ACCESS:
			return new MissingAccessError();
		case APIErrorCodes.MISSING_PERMISSIONS:
			return new MissingPermissionsError();
		case APIErrorCodes.COMMUNICATION_DISABLED:
			return new CommunicationDisabledError();
		case APIErrorCodes.THREAD_ARCHIVED:
			return new ThreadArchivedError();
		case APIErrorCodes.THREAD_LOCKED:
			return new ThreadLockedError();
		case APIErrorCodes.UNKNOWN_THREAD_MEMBER:
			return new UnknownThreadMemberError();
	}
}

export function assertThreadAllowed(denial: ThreadDenial | null): void {
	if (denial !== null) throw threadDenialError(denial);
}
