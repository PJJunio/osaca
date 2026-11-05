// SPDX-License-Identifier: AGPL-3.0-or-later

import {emitActivity} from '@app/api/infrastructure/activity/ActivityEvents';
import {Logger} from '@app/api/Logger';
import type {RequestCache} from '@app/api/middleware/RequestCacheMiddleware';
import type {User} from '@app/api/models/User';
import {RpcTimingRecorder} from '@app/api/rpc/RpcTimings';
import type {UserData} from '@app/api/rpc/RpcTypes';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import {UserFlags} from '@osaca/constants/src/UserConstants';
import type {RpcSessionTimings} from '@osaca/schema/src/domains/rpc/RpcSchemas';

interface SessionStartUserRepository extends Pick<UserRepository, 'updateFlags'> {}

interface SessionStartDeps {
	userRepository: SessionStartUserRepository;
}

interface ProcessSessionStartParams {
	userData: UserData;
	requestCache: RequestCache;
	geoipCountryIso: string | null;
	clientIp: string | null;
}

interface ProcessSessionStartResult {
	user: User;
	timings: RpcSessionTimings;
}

export class RpcSessionStartService {
	constructor(private readonly deps: SessionStartDeps) {}

	async processSessionStart(params: ProcessSessionStartParams): Promise<ProcessSessionStartResult> {
		const timings = new RpcTimingRecorder();
		const {userData, geoipCountryIso, clientIp} = params;
		let user = userData.user;
		const startedUser = user;
		void emitActivity(
			'session_started',
			startedUser.id.toString(),
			{
				user_id: startedUser.id.toString(),
				is_bot: startedUser.isBot,
				flags: startedUser.flags.toString(),
			},
			{
				ip: clientIp,
				country: geoipCountryIso,
				ua: null,
				locale: startedUser.locale,
				channel: 'other',
				request_id: null,
			},
		);
		timings.timeSync('clear_expired_custom_status', () => {
			const userSettings = userData.settings;
			if (userSettings?.customStatus?.isExpired()) {
				const clearedSettings = Object.assign(Object.create(Object.getPrototypeOf(userSettings)), userSettings, {
					customStatus: null,
				});
				userData.settings = clearedSettings;
			}
		});
		if (!(user.flags & UserFlags.HAS_SESSION_STARTED)) {
			await timings.time('persist_session_started_flag', async () => {
				try {
					const updatedUser = await this.deps.userRepository.updateFlags(
						user.id,
						(flags) => flags | UserFlags.HAS_SESSION_STARTED,
					);
					if (updatedUser) {
						user = updatedUser;
						userData.user = updatedUser;
					}
				} catch (error) {
					Logger.warn({userId: user.id, error}, 'Failed to persist the session started flag');
				}
			});
		}
		return {user, timings: timings.finalize()};
	}
}
