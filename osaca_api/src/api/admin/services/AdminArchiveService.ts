// SPDX-License-Identifier: AGPL-3.0-or-later

import {AdminArchive} from '@app/api/admin/models/AdminArchiveModel';
import type {AdminArchiveRepository} from '@app/api/admin/repositories/AdminArchiveRepository';
import type {UserID} from '@app/api/BrandedTypes';
import type {ISnowflakeService} from '@app/api/infrastructure/ISnowflakeService';
import type {UserRepository} from '@app/api/user/repositories/UserRepository';
import type {WorkerTaskName} from '@app/api/worker/WorkerLaneConfig';
import type {AdminArchiveResponse, ArchiveSubjectType} from '@osaca/schema/src/domains/admin/AdminArchiveSchemas';
import type {IWorkerService} from '@pkgs/worker/src/contracts/IWorkerService';
import {ms} from 'itty-time';

const ARCHIVE_RETENTION_DAYS = 365;

interface ListArchivesParams {
	subjectType: ArchiveSubjectType;
	subjectId: bigint;
	limit?: number;
	includeExpired?: boolean;
}

export class AdminArchiveService {
	constructor(
		private readonly adminArchiveRepository: AdminArchiveRepository,
		private readonly userRepository: UserRepository,
		private readonly snowflakeService: ISnowflakeService,
		private readonly workerService: IWorkerService<WorkerTaskName>,
	) {}

	private computeExpiry(): Date {
		return new Date(Date.now() + ARCHIVE_RETENTION_DAYS * ms('1 day'));
	}

	private async createQueuedArchive(
		subjectType: ArchiveSubjectType,
		subjectId: bigint,
		requestedBy: UserID,
	): Promise<AdminArchive> {
		const archiveId = await this.snowflakeService.generate();
		const archive = new AdminArchive({
			subject_type: subjectType,
			subject_id: subjectId,
			archive_id: archiveId,
			requested_by: requestedBy,
			requested_at: new Date(),
			started_at: null,
			completed_at: null,
			failed_at: null,
			storage_key: null,
			file_size: null,
			progress_percent: 0,
			progress_step: 'Queued',
			error_message: null,
			download_url_expires_at: null,
			expires_at: this.computeExpiry(),
		});
		await this.adminArchiveRepository.create(archive);
		return archive;
	}

	async triggerUserArchive(
		targetUserId: UserID,
		requestedBy: UserID,
		includeAttachments: boolean,
	): Promise<AdminArchiveResponse> {
		await this.userRepository.findUniqueAssert(targetUserId);
		const archive = await this.createQueuedArchive('user', targetUserId, requestedBy);
		await this.workerService.addJob('harvestUserData', {
			userId: targetUserId.toString(),
			harvestId: archive.archiveId.toString(),
			adminRequestedBy: requestedBy.toString(),
			includeAttachments,
		});
		return archive.toResponse();
	}

	async listArchives(params: ListArchivesParams): Promise<Array<AdminArchiveResponse>> {
		const {subjectType, subjectId, limit = 50, includeExpired = false} = params;
		const archives = await this.adminArchiveRepository.listBySubject(subjectType, subjectId, limit, includeExpired);
		return archives.map((a) => a.toResponse());
	}
}
