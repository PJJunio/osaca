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

interface StoredKeyPackage {
	hash: string;
	deviceId: string;
	keyPackage: string;
	consumedAt: string | null;
	createdAt: string;
}

export class InMemoryMlsDeliveryService implements IMlsDeliveryService {
	private readonly keyPackages: Array<StoredKeyPackage> = [];
	private readonly groups = new Map<string, MlsGroupResponse>();
	private readonly commits = new Map<string, string>();
	private readonly welcomes = new Map<string, string>();
	private readonly ciphertexts: Array<MlsCiphertextMessageResponse> = [];

	async publishKeyPackages(deviceId: string, packages: Array<string>): Promise<number> {
		let inserted = 0;
		for (const pkg of packages) {
			const hash = crypto.createHash('sha256').update(pkg).digest('hex');
			if (!this.keyPackages.some((p) => p.hash === hash)) {
				this.keyPackages.push({
					hash,
					deviceId,
					keyPackage: pkg,
					consumedAt: null,
					createdAt: new Date().toISOString(),
				});
				inserted += 1;
			}
		}
		return inserted;
	}

	async claimKeyPackage(deviceId: string): Promise<string> {
		const unconsumed = this.keyPackages
			.filter((p) => p.deviceId === deviceId && p.consumedAt === null)
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

		const first = unconsumed[0];
		if (!first) {
			throw new KeyPackageExhaustedError(deviceId);
		}
		first.consumedAt = new Date().toISOString();
		return first.keyPackage;
	}

	async createGroup(groupId: string, disappearingTtlSeconds?: number | null): Promise<MlsGroupResponse> {
		const existing = this.groups.get(groupId);
		const record: MlsGroupResponse = {
			group_id: groupId,
			current_epoch: existing?.current_epoch ?? 0,
			disappearing_ttl_seconds: disappearingTtlSeconds ?? null,
		};
		this.groups.set(groupId, record);
		return record;
	}

	async getGroup(groupId: string): Promise<MlsGroupResponse | null> {
		return this.groups.get(groupId) ?? null;
	}

	async postCommit(groupId: string, epoch: number, commit: string, welcome?: string | null): Promise<{epoch: number}> {
		const group = this.groups.get(groupId);
		if (!group) {
			throw new MlsGroupNotFoundError(groupId);
		}
		if (epoch !== group.current_epoch + 1) {
			throw new EpochConflictError({
				current_epoch: group.current_epoch,
				requested_epoch: epoch,
			});
		}

		this.commits.set(`${groupId}:${epoch}`, commit);
		if (welcome) {
			this.welcomes.set(`${groupId}:${epoch}`, welcome);
		}
		group.current_epoch = epoch;
		return {epoch};
	}

	async getCommit(groupId: string, epoch: number): Promise<MlsCommitDetailResponse | null> {
		const commit = this.commits.get(`${groupId}:${epoch}`);
		if (!commit) return null;
		return {group_id: groupId, epoch, commit};
	}

	async getWelcome(groupId: string, epoch: number): Promise<MlsWelcomeDetailResponse | null> {
		const welcome = this.welcomes.get(`${groupId}:${epoch}`);
		if (!welcome) return null;
		return {group_id: groupId, epoch, welcome};
	}

	async postCiphertext(
		groupId: string,
		epoch: number,
		messageId: string,
		ciphertext: string,
	): Promise<MlsCiphertextMessageResponse> {
		const group = this.groups.get(groupId);
		if (!group) {
			throw new MlsGroupNotFoundError(groupId);
		}

		const ttl = group.disappearing_ttl_seconds;
		const now = Date.now();
		const expiresAt = ttl && ttl > 0 ? new Date(now + ttl * 1000).toISOString() : null;

		const record: MlsCiphertextMessageResponse = {
			group_id: groupId,
			epoch,
			message_id: messageId,
			ciphertext,
			created_at: new Date(now).toISOString(),
			expires_at: expiresAt,
		};

		const existingIdx = this.ciphertexts.findIndex((m) => m.group_id === groupId && m.message_id === messageId);
		if (existingIdx >= 0) {
			this.ciphertexts[existingIdx] = record;
		} else {
			this.ciphertexts.push(record);
		}
		return record;
	}

	async getCiphertextHistory(
		groupId: string,
		memberJoinEpoch: number,
		before?: string,
		limit = 50,
	): Promise<Array<MlsCiphertextMessageResponse>> {
		const now = Date.now();
		const clampedLimit = Math.max(1, Math.min(limit, 100));

		const matching = this.ciphertexts
			.filter((m) => {
				if (m.group_id !== groupId) return false;
				if (m.epoch < memberJoinEpoch) return false;
				if (m.expires_at && new Date(m.expires_at).getTime() <= now) return false;
				return true;
			})
			.sort((a, b) => {
				const timeCmp = b.created_at.localeCompare(a.created_at);
				if (timeCmp !== 0) return timeCmp;
				return b.message_id.localeCompare(a.message_id);
			});

		if (before) {
			const cursorIndex = matching.findIndex((m) => m.message_id === before);
			if (cursorIndex >= 0) {
				return matching.slice(cursorIndex + 1, cursorIndex + 1 + clampedLimit);
			}
		}

		return matching.slice(0, clampedLimit);
	}
}
