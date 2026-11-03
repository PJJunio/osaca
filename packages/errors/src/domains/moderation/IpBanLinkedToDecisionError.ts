// SPDX-License-Identifier: AGPL-3.0-or-later

import {APIErrorCodes} from '@osaca/constants/src/ApiErrorCodes';
import {ConflictError} from '@osaca/errors/src/domains/core/ConflictError';

export class IpBanLinkedToDecisionError extends ConflictError {
	constructor(decisionId: bigint) {
		super({code: APIErrorCodes.IP_BAN_LINKED_TO_DECISION, data: {decision_id: decisionId.toString()}});
	}
}
