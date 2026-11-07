// SPDX-License-Identifier: AGPL-3.0-or-later

import {createUserID, type UserID} from '@app/api/BrandedTypes';
import {ContentBlocklistCategory} from '@app/api/constants/ContentModeration';
import {
	deleteOneOrMany,
	executeConditional,
	fetchMany,
	fetchOne,
	upsertOne,
} from '@app/api/database/CassandraQueryExecution';
import type {
	AdminAuditLogRow,
	BannedAvatarHashRow,
	BannedFileShaRow,
	BannedProfileSubstringRow,
	BannedProfileSubstringScope,
	BannedUrlDomainRow,
	BannedUrlRow,
} from '@app/api/database/types/AdminArchiveTypes';
import {
	AdminAuditLogs,
	BannedAvatarHashes,
	BannedFileShas,
	BannedProfileSubstrings,
	BannedUrlDomains,
	BannedUrls,
} from '@app/api/Tables';
import {canonicalizeStoredPhrase} from '@app/api/utils/PhraseBlocklistNormalization';

export interface AdminAuditLog {
	logId: bigint;
	adminUserId: UserID;
	targetType: string;
	targetId: bigint;
	action: string;
	auditLogReason: string | null;
	metadata: Map<string, string>;
	createdAt: Date;
}

export type BannedIpKind = 'permanent' | 'temporary_24h';

export interface BannedIpEntry {
	ip: string;
	kind: BannedIpKind;
	reason: string | null;
	expiresAt: Date | null;
	createdAt: Date | null;
	decisionId: bigint | null;
}

const FETCH_AUDIT_LOG_BY_ID_QUERY = AdminAuditLogs.select({
	where: AdminAuditLogs.where.eq('log_id'),
});
const FETCH_AUDIT_LOGS_BY_IDS_QUERY = AdminAuditLogs.select({
	where: AdminAuditLogs.where.in('log_id', 'log_ids'),
});

const LOAD_ALL_BANNED_URLS_QUERY = BannedUrls.select();
const LOAD_ALL_BANNED_URL_DOMAINS_QUERY = BannedUrlDomains.select();
const LOAD_ALL_BANNED_FILE_SHAS_QUERY = BannedFileShas.select();
const LOAD_ALL_BANNED_AVATAR_HASHES_QUERY = BannedAvatarHashes.select();
const LOAD_ALL_BANNED_PROFILE_SUBSTRINGS_QUERY = BannedProfileSubstrings.select();
const createListAllAuditLogsPaginatedQuery = (limit: number) =>
	AdminAuditLogs.select({
		where: AdminAuditLogs.where.tokenGt('log_id', 'last_log_id'),
		limit,
	});
const createListAllAuditLogsFirstPageQuery = (limit: number) =>
	AdminAuditLogs.select({
		limit,
	});


export class AdminRepository {
	async createAuditLog(log: AdminAuditLogRow): Promise<AdminAuditLog> {
		await upsertOne(AdminAuditLogs.insert(log));
		return this.mapRowToAuditLog(log);
	}

	async redactAuditLog(
		logId: bigint,
		targetId: bigint,
		dropMetadataKeys: ReadonlyArray<string>,
	): Promise<AdminAuditLog | null> {
		const row = await fetchOne<AdminAuditLogRow>(FETCH_AUDIT_LOG_BY_ID_QUERY.bind({log_id: logId}));
		if (!row) {
			return null;
		}
		const metadata = new Map(row.metadata ?? []);
		for (const key of dropMetadataKeys) {
			metadata.delete(key);
		}
		const redacted: AdminAuditLogRow = {...row, target_id: targetId, metadata};
		await upsertOne(AdminAuditLogs.insert(redacted));
		return this.mapRowToAuditLog(redacted);
	}

	async getAuditLog(logId: bigint): Promise<AdminAuditLog | null> {
		const row = await fetchOne<AdminAuditLogRow>(FETCH_AUDIT_LOG_BY_ID_QUERY.bind({log_id: logId}));
		return row ? this.mapRowToAuditLog(row) : null;
	}

	async listAuditLogsByIds(logIds: Array<bigint>): Promise<Array<AdminAuditLog>> {
		if (logIds.length === 0) {
			return [];
		}
		const rows = await fetchMany<AdminAuditLogRow>(FETCH_AUDIT_LOGS_BY_IDS_QUERY.bind({log_ids: logIds}));
		return rows.map((row) => this.mapRowToAuditLog(row));
	}

	async listAllAuditLogsPaginated(limit: number, lastLogId?: bigint): Promise<Array<AdminAuditLog>> {
		let rows: Array<AdminAuditLogRow>;
		if (lastLogId) {
			const query = createListAllAuditLogsPaginatedQuery(limit);
			rows = await fetchMany<AdminAuditLogRow>(query.bind({last_log_id: lastLogId}));
		} else {
			const query = createListAllAuditLogsFirstPageQuery(limit);
			rows = await fetchMany<AdminAuditLogRow>(query.bind({}));
		}
		return rows.map((row) => this.mapRowToAuditLog(row));
	}

	async isIpBanned(_ip: string): Promise<boolean> {
		return false;
	}

	async banIp(_ip: string, _ttlSeconds: number | null = null): Promise<void> {}

	async banIpTemp(_ip: string, _ttlSeconds: number): Promise<void> {}

	async findIpBanDecision(_ip: string): Promise<bigint | null> {
		return null;
	}

	async banIpForDecision(_ip: string, _decisionId: bigint, _expiresAt: Date): Promise<BannedIpEntry | null> {
		return null;
	}

	async listDecisionIpBans(_decisionId: bigint): Promise<Array<BannedIpEntry>> {
		return [];
	}

	async relinkDecisionIpBans(_fromDecisionId: bigint, _toDecisionId: bigint): Promise<Array<BannedIpEntry>> {
		return [];
	}

	async removeDecisionIpBans(_decisionIds: ReadonlyArray<bigint>): Promise<Array<BannedIpEntry>> {
		return [];
	}

	async unbanIp(_ip: string): Promise<void> {}

	async loadAllBannedIpEntries(): Promise<Array<BannedIpEntry>> {
		return [];
	}

	async banPhrase(_phrase: string): Promise<void> {}

	async unbanPhrase(_phrase: string): Promise<void> {}

	async loadAllBannedPhrases(): Promise<Array<string>> {
		return [];
	}

	async banUrl(row: BannedUrlRow): Promise<void> {
		await upsertOne(BannedUrls.insert({...row, url_canonical: row.url_canonical.toLowerCase()}));
	}

	async unbanUrl(url: string): Promise<void> {
		await deleteOneOrMany(BannedUrls.deleteByPk({url_canonical: url.toLowerCase()}));
	}

	async loadAllBannedUrls(): Promise<Array<BannedUrlRow>> {
		return fetchMany<BannedUrlRow>(LOAD_ALL_BANNED_URLS_QUERY.bind({}));
	}

	async banUrlDomain(row: BannedUrlDomainRow): Promise<void> {
		await upsertOne(BannedUrlDomains.insert({...row, domain: row.domain.toLowerCase()}));
	}

	async unbanUrlDomain(domain: string): Promise<void> {
		await deleteOneOrMany(BannedUrlDomains.deleteByPk({domain: domain.toLowerCase()}));
	}

	async loadAllBannedUrlDomains(): Promise<Array<BannedUrlDomainRow>> {
		return fetchMany<BannedUrlDomainRow>(LOAD_ALL_BANNED_URL_DOMAINS_QUERY.bind({}));
	}

	async banFileSha(row: BannedFileShaRow): Promise<void> {
		await upsertOne(BannedFileShas.insert({...row, sha256_hex: row.sha256_hex.toLowerCase()}));
	}

	async unbanFileSha(sha256Hex: string): Promise<void> {
		await deleteOneOrMany(BannedFileShas.deleteByPk({sha256_hex: sha256Hex.toLowerCase()}));
	}

	async unbanFeedFileSha(sha256Hex: string): Promise<boolean> {
		return executeConditional(
			BannedFileShas.conditionalDeleteByPk(
				{sha256_hex: sha256Hex.toLowerCase()},
				{added_by: null, category: ContentBlocklistCategory.MALWARE_BAZAAR},
			),
		);
	}

	async loadAllBannedFileShas(): Promise<Array<BannedFileShaRow>> {
		return fetchMany<BannedFileShaRow>(LOAD_ALL_BANNED_FILE_SHAS_QUERY.bind({}));
	}

	async banAvatarHash(row: BannedAvatarHashRow): Promise<void> {
		await upsertOne(BannedAvatarHashes.insert({...row, hash_short: row.hash_short.toLowerCase()}));
	}

	async unbanAvatarHash(hashShort: string): Promise<void> {
		await deleteOneOrMany(BannedAvatarHashes.deleteByPk({hash_short: hashShort.toLowerCase()}));
	}

	async loadAllBannedAvatarHashes(): Promise<Array<BannedAvatarHashRow>> {
		return fetchMany<BannedAvatarHashRow>(LOAD_ALL_BANNED_AVATAR_HASHES_QUERY.bind({}));
	}

	async banProfileSubstring(row: BannedProfileSubstringRow): Promise<void> {
		const canonical = canonicalizeStoredPhrase(row.substring);
		if (!canonical) return;
		await upsertOne(BannedProfileSubstrings.insert({...row, substring: canonical}));
	}

	async unbanProfileSubstring(scope: BannedProfileSubstringScope, substring: string): Promise<void> {
		const canonical = canonicalizeStoredPhrase(substring);
		if (!canonical) return;
		await deleteOneOrMany(BannedProfileSubstrings.deleteByPk({scope, substring: canonical}));
	}

	async loadAllBannedProfileSubstrings(): Promise<Array<BannedProfileSubstringRow>> {
		return fetchMany<BannedProfileSubstringRow>(LOAD_ALL_BANNED_PROFILE_SUBSTRINGS_QUERY.bind({}));
	}

	private mapRowToAuditLog(row: AdminAuditLogRow): AdminAuditLog {
		return {
			logId: row.log_id,
			adminUserId: createUserID(row.admin_user_id),
			targetType: row.target_type,
			targetId: row.target_id,
			action: row.action,
			auditLogReason: row.audit_log_reason,
			metadata: row.metadata || new Map(),
			createdAt: row.created_at,
		};
	}
}
