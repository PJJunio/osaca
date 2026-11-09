// SPDX-License-Identifier: AGPL-3.0-or-later

import crypto from 'node:crypto';
import type {IMlsDeliveryService} from '@app/api/mls/IMlsDeliveryService';
import {EpochConflictError} from '@osaca/errors/src/domains/mls/EpochConflictError';
import {KeyPackageExhaustedError} from '@osaca/errors/src/domains/mls/KeyPackageExhaustedError';
import {MlsGroupNotFoundError} from '@osaca/errors/src/domains/mls/MlsGroupNotFoundError';
import type {
	MlsCiphertextMessageResponse,
	MlsCommitDetailResponse,
	MlsGroupResponse,
	MlsWelcomeDetailResponse,
} from '@osaca/schema/src/domains/mls/MlsSchemas';
import type {IPostgresClient} from '@pkgs/postgres/src/Client';

export async function ensureMlsSchema(client: IPostgresClient): Promise<void> {
	await client.query(`
CREATE TABLE IF NOT EXISTS mls_key_packages (
    key_package_hash text PRIMARY KEY,
    device_id text NOT NULL,
    key_package_bytes bytea NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mls_key_packages_unconsumed_idx
ON mls_key_packages (device_id, created_at)
WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS mls_groups (
    group_id text PRIMARY KEY,
    current_epoch bigint NOT NULL DEFAULT 0,
    disappearing_ttl_seconds integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mls_commits (
    group_id text NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
    epoch bigint NOT NULL,
    commit_bytes bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, epoch)
);

CREATE TABLE IF NOT EXISTS mls_welcomes (
    group_id text NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
    epoch bigint NOT NULL,
    welcome_bytes bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, epoch)
);

CREATE TABLE IF NOT EXISTS mls_ciphertext_messages (
    group_id text NOT NULL REFERENCES mls_groups(group_id) ON DELETE CASCADE,
    epoch bigint NOT NULL,
    message_id text NOT NULL,
    ciphertext bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    PRIMARY KEY (group_id, message_id)
);

CREATE INDEX IF NOT EXISTS mls_ciphertext_messages_history_idx
ON mls_ciphertext_messages (group_id, epoch, created_at DESC, message_id DESC);

CREATE INDEX IF NOT EXISTS mls_ciphertext_messages_expires_idx
ON mls_ciphertext_messages (expires_at)
WHERE expires_at IS NOT NULL;
`);
}

export class PostgresMlsDeliveryService implements IMlsDeliveryService {
	constructor(private readonly postgres: IPostgresClient) {}

	async publishKeyPackages(deviceId: string, packages: Array<string>): Promise<number> {
		if (packages.length === 0) return 0;
		let inserted = 0;
		for (const pkg of packages) {
			const hash = crypto.createHash('sha256').update(pkg).digest('hex');
			const res = await this.postgres.query(
				`INSERT INTO mls_key_packages (key_package_hash, device_id, key_package_bytes, created_at)
				 VALUES ($1, $2, decode($3, 'base64'), now())
				 ON CONFLICT (key_package_hash) DO NOTHING;`,
				[hash, deviceId, pkg],
			);
			inserted += res.rowCount ?? 0;
		}
		return inserted;
	}

	async claimKeyPackage(deviceId: string): Promise<string> {
		const res = await this.postgres.query<{key_package_base64: string}>(
			`WITH candidate AS (
				SELECT key_package_hash
				FROM mls_key_packages
				WHERE device_id = $1 AND consumed_at IS NULL
				ORDER BY created_at ASC
				LIMIT 1
				FOR UPDATE SKIP LOCKED
			)
			UPDATE mls_key_packages
			SET consumed_at = now()
			FROM candidate
			WHERE mls_key_packages.key_package_hash = candidate.key_package_hash
			RETURNING encode(mls_key_packages.key_package_bytes, 'base64') AS key_package_base64;`,
			[deviceId],
		);

		if (res.rows.length === 0) {
			throw new KeyPackageExhaustedError(deviceId);
		}
		return res.rows[0].key_package_base64;
	}

	async createGroup(groupId: string, disappearingTtlSeconds?: number | null): Promise<MlsGroupResponse> {
		const res = await this.postgres.query<{
			group_id: string;
			current_epoch: string;
			disappearing_ttl_seconds: number | null;
		}>(
			`INSERT INTO mls_groups (group_id, current_epoch, disappearing_ttl_seconds, created_at, updated_at)
			 VALUES ($1, 0, $2, now(), now())
			 ON CONFLICT (group_id) DO UPDATE
			 SET disappearing_ttl_seconds = EXCLUDED.disappearing_ttl_seconds, updated_at = now()
			 RETURNING group_id, current_epoch, disappearing_ttl_seconds;`,
			[groupId, disappearingTtlSeconds ?? null],
		);

		const row = res.rows[0];
		return {
			group_id: row.group_id,
			current_epoch: Number(row.current_epoch),
			disappearing_ttl_seconds: row.disappearing_ttl_seconds,
		};
	}

	async getGroup(groupId: string): Promise<MlsGroupResponse | null> {
		const res = await this.postgres.query<{
			group_id: string;
			current_epoch: string;
			disappearing_ttl_seconds: number | null;
		}>(
			`SELECT group_id, current_epoch, disappearing_ttl_seconds
			 FROM mls_groups WHERE group_id = $1;`,
			[groupId],
		);

		if (res.rows.length === 0) return null;
		const row = res.rows[0];
		return {
			group_id: row.group_id,
			current_epoch: Number(row.current_epoch),
			disappearing_ttl_seconds: row.disappearing_ttl_seconds,
		};
	}

	async postCommit(groupId: string, epoch: number, commit: string, welcome?: string | null): Promise<{epoch: number}> {
		return await this.postgres.transaction(async (tx) => {
			const groupRes = await tx.query<{current_epoch: string}>(
				`SELECT current_epoch FROM mls_groups WHERE group_id = $1 FOR UPDATE;`,
				[groupId],
			);
			if (groupRes.rows.length === 0) {
				throw new MlsGroupNotFoundError(groupId);
			}

			const currentEpoch = Number(groupRes.rows[0].current_epoch);
			if (epoch !== currentEpoch + 1) {
				throw new EpochConflictError({
					current_epoch: currentEpoch,
					requested_epoch: epoch,
				});
			}

			await tx.query(
				`INSERT INTO mls_commits (group_id, epoch, commit_bytes, created_at)
				 VALUES ($1, $2, decode($3, 'base64'), now());`,
				[groupId, epoch, commit],
			);

			if (welcome) {
				await tx.query(
					`INSERT INTO mls_welcomes (group_id, epoch, welcome_bytes, created_at)
					 VALUES ($1, $2, decode($3, 'base64'), now());`,
					[groupId, epoch, welcome],
				);
			}

			await tx.query(`UPDATE mls_groups SET current_epoch = $2, updated_at = now() WHERE group_id = $1;`, [
				groupId,
				epoch,
			]);

			return {epoch};
		});
	}

	async getCommit(groupId: string, epoch: number): Promise<MlsCommitDetailResponse | null> {
		const res = await this.postgres.query<{commit_base64: string}>(
			`SELECT encode(commit_bytes, 'base64') AS commit_base64
			 FROM mls_commits WHERE group_id = $1 AND epoch = $2;`,
			[groupId, epoch],
		);
		if (res.rows.length === 0) return null;
		return {group_id: groupId, epoch, commit: res.rows[0].commit_base64};
	}

	async getWelcome(groupId: string, epoch: number): Promise<MlsWelcomeDetailResponse | null> {
		const res = await this.postgres.query<{welcome_base64: string}>(
			`SELECT encode(welcome_bytes, 'base64') AS welcome_base64
			 FROM mls_welcomes WHERE group_id = $1 AND epoch = $2;`,
			[groupId, epoch],
		);
		if (res.rows.length === 0) return null;
		return {group_id: groupId, epoch, welcome: res.rows[0].welcome_base64};
	}

	async postCiphertext(
		groupId: string,
		epoch: number,
		messageId: string,
		ciphertext: string,
	): Promise<MlsCiphertextMessageResponse> {
		const groupRes = await this.postgres.query<{disappearing_ttl_seconds: number | null}>(
			`SELECT disappearing_ttl_seconds FROM mls_groups WHERE group_id = $1;`,
			[groupId],
		);
		if (groupRes.rows.length === 0) {
			throw new MlsGroupNotFoundError(groupId);
		}
		const ttl = groupRes.rows[0].disappearing_ttl_seconds;
		const expiresAt = ttl && ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null;

		const res = await this.postgres.query<{
			group_id: string;
			epoch: string;
			message_id: string;
			ciphertext_base64: string;
			created_at: Date;
			expires_at: Date | null;
		}>(
			`INSERT INTO mls_ciphertext_messages (group_id, epoch, message_id, ciphertext, created_at, expires_at)
			 VALUES ($1, $2, $3, decode($4, 'base64'), now(), $5)
			 RETURNING group_id, epoch, message_id, encode(ciphertext, 'base64') AS ciphertext_base64, created_at, expires_at;`,
			[groupId, epoch, messageId, ciphertext, expiresAt],
		);

		const row = res.rows[0];
		return {
			group_id: row.group_id,
			epoch: Number(row.epoch),
			message_id: row.message_id,
			ciphertext: row.ciphertext_base64,
			created_at: row.created_at.toISOString(),
			expires_at: row.expires_at ? row.expires_at.toISOString() : null,
		};
	}

	async getCiphertextHistory(
		groupId: string,
		memberJoinEpoch: number,
		before?: string,
		limit = 50,
	): Promise<Array<MlsCiphertextMessageResponse>> {
		const limitClamped = Math.max(1, Math.min(limit, 100));
		let sql: string;
		let values: Array<unknown>;

		if (before) {
			const cursorRes = await this.postgres.query<{created_at: Date}>(
				`SELECT created_at FROM mls_ciphertext_messages WHERE group_id = $1 AND message_id = $2;`,
				[groupId, before],
			);
			if (cursorRes.rows.length > 0) {
				const cursorCreatedAt = cursorRes.rows[0].created_at;
				sql = `SELECT group_id, epoch, message_id, encode(ciphertext, 'base64') AS ciphertext_base64, created_at, expires_at
					   FROM mls_ciphertext_messages
					   WHERE group_id = $1
					     AND epoch >= $2
					     AND (expires_at IS NULL OR expires_at > now())
					     AND (created_at, message_id) < ($3, $4)
					   ORDER BY created_at DESC, message_id DESC
					   LIMIT $5;`;
				values = [groupId, memberJoinEpoch, cursorCreatedAt, before, limitClamped];
			} else {
				sql = `SELECT group_id, epoch, message_id, encode(ciphertext, 'base64') AS ciphertext_base64, created_at, expires_at
					   FROM mls_ciphertext_messages
					   WHERE group_id = $1
					     AND epoch >= $2
					     AND (expires_at IS NULL OR expires_at > now())
					   ORDER BY created_at DESC, message_id DESC
					   LIMIT $3;`;
				values = [groupId, memberJoinEpoch, limitClamped];
			}
		} else {
			sql = `SELECT group_id, epoch, message_id, encode(ciphertext, 'base64') AS ciphertext_base64, created_at, expires_at
				   FROM mls_ciphertext_messages
				   WHERE group_id = $1
				     AND epoch >= $2
				     AND (expires_at IS NULL OR expires_at > now())
				   ORDER BY created_at DESC, message_id DESC
				   LIMIT $3;`;
			values = [groupId, memberJoinEpoch, limitClamped];
		}

		const res = await this.postgres.query<{
			group_id: string;
			epoch: string;
			message_id: string;
			ciphertext_base64: string;
			created_at: Date;
			expires_at: Date | null;
		}>(sql, values);

		return res.rows.map((row) => ({
			group_id: row.group_id,
			epoch: Number(row.epoch),
			message_id: row.message_id,
			ciphertext: row.ciphertext_base64,
			created_at: row.created_at.toISOString(),
			expires_at: row.expires_at ? row.expires_at.toISOString() : null,
		}));
	}

	async deleteCiphertext(groupId: string, messageId: string): Promise<boolean> {
		const res = await this.postgres.query(
			`DELETE FROM mls_ciphertext_messages WHERE group_id = $1 AND message_id = $2;`,
			[groupId, messageId],
		);
		return (res.rowCount ?? 0) > 0;
	}
}
