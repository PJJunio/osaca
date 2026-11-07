// SPDX-License-Identifier: AGPL-3.0-or-later

import type {GuildID, UserID} from '@app/api/BrandedTypes';
import type {GuildVisitRow} from '@app/api/database/types/GuildVisitTypes';
import {GUILD_VISIT_TTL_SECONDS} from '@osaca/constants/src/GuildVisitConstants';

const MAX_GUILD_PAGE = 5000;
const USER_PARTITION_LIMIT = 200;

interface StoredGuildVisit {
	row: GuildVisitRow;
	expiresAt: number;
}

export class GuildVisitRepository {
	private readonly entries = new Map<string, StoredGuildVisit>();

	private key(userId: UserID, guildId: GuildID): string {
		return `${userId}:${guildId}`;
	}

	clear(): void {
		this.entries.clear();
	}

	async get(userId: UserID, guildId: GuildID): Promise<GuildVisitRow | null> {
		const key = this.key(userId, guildId);
		const entry = this.entries.get(key);
		if (!entry) return null;
		if (entry.expiresAt <= Date.now()) {
			this.entries.delete(key);
			return null;
		}
		return entry.row;
	}

	async list(userId: UserID): Promise<Array<GuildVisitRow>> {
		const now = Date.now();
		const rows: Array<GuildVisitRow> = [];
		for (const [key, entry] of this.entries) {
			if (entry.expiresAt <= now) {
				this.entries.delete(key);
				continue;
			}
			if (entry.row.user_id === userId) {
				rows.push(entry.row);
				if (rows.length >= USER_PARTITION_LIMIT) break;
			}
		}
		return rows;
	}

	async upsert(row: GuildVisitRow, now: Date = new Date()): Promise<boolean> {
		let ttl: number;
		if (row.invite_expires_at === null) {
			ttl = GUILD_VISIT_TTL_SECONDS;
		} else {
			const remaining = Math.floor((row.invite_expires_at.getTime() - now.getTime()) / 1000);
			ttl = Math.max(0, Math.min(GUILD_VISIT_TTL_SECONDS, remaining));
		}
		if (ttl <= 0) return false;
		this.entries.set(this.key(row.user_id, row.guild_id), {
			row: {...row},
			expiresAt: now.getTime() + ttl * 1000,
		});
		return true;
	}

	async touch(row: GuildVisitRow, now: Date = new Date()): Promise<GuildVisitRow> {
		const touched = {...row, opened_at: now};
		await this.upsert(touched, now);
		return touched;
	}

	async delete(userId: UserID, guildId: GuildID): Promise<void> {
		this.entries.delete(this.key(userId, guildId));
	}

	async deleteAllForUser(userId: UserID): Promise<Array<GuildID>> {
		const rows = await this.list(userId);
		for (const row of rows) {
			await this.delete(userId, row.guild_id);
		}
		return rows.map((row) => row.guild_id);
	}

	async pageByGuild(
		guildId: GuildID,
		afterUserId: UserID | null,
		limit: number,
	): Promise<{rows: Array<GuildVisitRow>; next: UserID | null}> {
		const bounded = Math.max(1, Math.min(MAX_GUILD_PAGE, Math.floor(limit)));
		const now = Date.now();
		const matching: Array<GuildVisitRow> = [];
		for (const [key, entry] of this.entries) {
			if (entry.expiresAt <= now) {
				this.entries.delete(key);
				continue;
			}
			if (entry.row.guild_id !== guildId) continue;
			if (afterUserId !== null && entry.row.user_id <= afterUserId) continue;
			matching.push(entry.row);
		}
		matching.sort((a, b) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0));
		const rows = matching.slice(0, bounded);
		const next = rows.length === bounded ? rows[rows.length - 1]!.user_id : null;
		return {rows, next};
	}

	async pageVisitorIds(
		afterUserId: UserID | null,
		limit: number,
	): Promise<{userIds: Array<UserID>; next: UserID | null}> {
		const bounded = Math.max(1, Math.min(MAX_GUILD_PAGE, Math.floor(limit)));
		const now = Date.now();
		const matching: Array<GuildVisitRow> = [];
		for (const [key, entry] of this.entries) {
			if (entry.expiresAt <= now) {
				this.entries.delete(key);
				continue;
			}
			if (afterUserId !== null && entry.row.user_id <= afterUserId) continue;
			matching.push(entry.row);
		}
		matching.sort((a, b) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0));
		const rows = matching.slice(0, bounded);
		const userIds = [...new Set(rows.map((row) => row.user_id))];
		const next = rows.length === bounded ? rows[rows.length - 1]!.user_id : null;
		return {userIds, next};
	}
}
