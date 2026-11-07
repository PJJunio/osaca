// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
	MlsCiphertextMessageResponse,
	MlsCommitDetailResponse,
	MlsGroupResponse,
	MlsWelcomeDetailResponse,
} from '@osaca/schema/src/domains/mls/MlsSchemas';

export interface IMlsDeliveryService {
	publishKeyPackages(deviceId: string, packages: Array<string>): Promise<number>;
	claimKeyPackage(deviceId: string): Promise<string>;
	createGroup(groupId: string, disappearingTtlSeconds?: number | null): Promise<MlsGroupResponse>;
	getGroup(groupId: string): Promise<MlsGroupResponse | null>;
	postCommit(groupId: string, epoch: number, commit: string, welcome?: string | null): Promise<{epoch: number}>;
	getCommit(groupId: string, epoch: number): Promise<MlsCommitDetailResponse | null>;
	getWelcome(groupId: string, epoch: number): Promise<MlsWelcomeDetailResponse | null>;
	postCiphertext(
		groupId: string,
		epoch: number,
		messageId: string,
		ciphertext: string,
	): Promise<MlsCiphertextMessageResponse>;
	getCiphertextHistory(
		groupId: string,
		memberJoinEpoch: number,
		before?: string,
		limit?: number,
	): Promise<Array<MlsCiphertextMessageResponse>>;
}
