// SPDX-License-Identifier: AGPL-3.0-or-later

import type {UserID} from '@app/api/BrandedTypes';

export class IpAuthorizationRepository {
	async checkIpAuthorized(_userId: UserID, _ip: string): Promise<boolean> {
		return true;
	}

	async createAuthorizedIp(_userId: UserID, _ip: string): Promise<void> {}

	async getAuthorizedIps(_userId: UserID): Promise<
		Array<{
			ip: string;
		}>
	> {
		return [];
	}

	async deleteAllAuthorizedIps(_userId: UserID): Promise<void> {}
}
