// SPDX-License-Identifier: AGPL-3.0-or-later

import {randomUUID} from 'node:crypto';
import {AdminArchive} from '@app/api/admin/models/AdminArchiveModel';
import type {ArchiveSubjectType} from '@osaca/schema/src/domains/admin/AdminArchiveSchemas';

export class AdminArchiveRepository {
	async create(_archive: AdminArchive): Promise<void> {}

	async markAsStarted(archive: AdminArchive, progressStep = 'Starting archive'): Promise<AdminArchive> {
		return new AdminArchive({
			...archive.toRow(),
			attempt_id: randomUUID(),
			started_at: new Date(),
			failed_at: null,
			error_message: null,
			progress_percent: 0,
			progress_step: progressStep,
		});
	}

	async updateProgress(_archive: AdminArchive, _progressPercent: number, _progressStep: string): Promise<void> {}

	async markAsCompleted(
		_archive: AdminArchive,
		_storageKey: string,
		_fileSize: bigint,
		_downloadUrlExpiresAt: Date,
	): Promise<void> {}

	async markAsFailed(_archive: AdminArchive, _errorMessage: string): Promise<void> {}

	async markAsTerminallyFailed(_archive: AdminArchive, _errorMessage: string): Promise<void> {}

	async findBySubjectAndArchiveId(
		_subjectType: ArchiveSubjectType,
		_subjectId: bigint,
		_archiveId: bigint,
	): Promise<AdminArchive | null> {
		return null;
	}

	async listBySubject(
		_subjectType: ArchiveSubjectType,
		_subjectId: bigint,
		_limit = 20,
		_includeExpired = false,
	): Promise<Array<AdminArchive>> {
		return [];
	}

	async listByType(
		_subjectType: ArchiveSubjectType,
		_limit = 50,
		_includeExpired = false,
	): Promise<Array<AdminArchive>> {
		return [];
	}

	async listByRequester(_requestedBy: bigint, _limit = 50, _includeExpired = false): Promise<Array<AdminArchive>> {
		return [];
	}
}
