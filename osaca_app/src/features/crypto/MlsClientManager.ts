// SPDX-License-Identifier: AGPL-3.0-or-later

import {Endpoints} from '@app/features/app/constants/Endpoints';
import {AppStorageKey} from '@app/features/platform/state/AppStorageKeys';
import AppStorage from '@app/features/platform/state/PersistentStorage';
import {http} from '@app/features/platform/transport/RestTransport';
import {HttpError} from '@app/features/platform/types/EndpointError';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {DeviceSession, IdentityKey, initCryptoWasm, MlsGroupSession, RecoveryKit} from '@osaca/crypto';
import cryptoWasmUrl from '@osaca/crypto/wasm/osaca_crypto_bg.wasm';
import {formatMlsApplicationPayload, type MlsApplicationPayload} from '@osaca/schema/src/domains/mls/MlsPayloadSchemas';
import type {
	MlsCiphertextMessageResponse,
	MlsClaimKeyPackageResponse,
	MlsCommitResponse,
	MlsGroupResponse,
	MlsKeyPackagesPublishResponse,
	MlsWelcomeDetailResponse,
} from '@osaca/schema/src/domains/mls/MlsSchemas';
import {tofuKeyManager} from './TofuKeyManager';

const logger = new Logger('MlsClientManager');

export function bytesToBase64(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]!);
	}
	return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
	if (typeof Buffer !== 'undefined') {
		return new Uint8Array(Buffer.from(base64, 'base64'));
	}
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

export class MlsClientManager {
	private static instance: MlsClientManager | null = null;

	private accountId: string | null = null;
	private deviceId: string | null = null;
	private identityKey: IdentityKey | null = null;
	private deviceSession: DeviceSession | null = null;
	private readonly activeGroups = new Map<string, MlsGroupSession>();

	static getInstance(): MlsClientManager {
		if (!MlsClientManager.instance) {
			MlsClientManager.instance = new MlsClientManager();
		}
		return MlsClientManager.instance;
	}

	async initialize(accountId: string): Promise<void> {
		await initCryptoWasm(cryptoWasmUrl);
		this.accountId = accountId;

		const storagePrefix = `${accountId}:`;
		const seedKey = `${AppStorageKey.MLS_IDENTITY_SEED}:${storagePrefix}`;
		const devIdKey = `${AppStorageKey.MLS_DEVICE_ID}:${storagePrefix}`;

		let seedHex = AppStorage.getItem(seedKey);
		let deviceId = AppStorage.getItem(devIdKey);

		if (!seedHex) {
			const newIdentity = IdentityKey.generate(accountId);
			seedHex = bytesToHex(newIdentity.seed);
			AppStorage.setItem(seedKey, seedHex);
			this.identityKey = newIdentity;
		} else {
			this.identityKey = IdentityKey.fromSeed(accountId, hexToBytes(seedHex));
		}

		if (!deviceId) {
			deviceId = `device_${accountId}_${Math.random().toString(36).slice(2, 10)}`;
			AppStorage.setItem(devIdKey, deviceId);
		}
		this.deviceId = deviceId;

		this.deviceSession = DeviceSession.create(accountId, deviceId);
		logger.info('Initialized MLS DeviceSession', {accountId, deviceId});

		tofuKeyManager.initialize(accountId);

		await this.publishInitialKeyPackages();
	}

	getAccountId(): string | null {
		return this.accountId;
	}

	getDeviceId(): string | null {
		return this.deviceId;
	}

	getIdentityKey(): IdentityKey | null {
		return this.identityKey;
	}

	getDeviceSession(): DeviceSession {
		if (!this.deviceSession) {
			throw new Error('MLS DeviceSession not initialized');
		}
		return this.deviceSession;
	}

	async publishInitialKeyPackages(count = 10): Promise<number> {
		const session = this.getDeviceSession();
		const packages: Array<string> = [];
		for (let i = 0; i < count; i++) {
			const kp = session.generateKeyPackage();
			packages.push(bytesToBase64(kp));
		}

		try {
			const res = await http.post<MlsKeyPackagesPublishResponse>(Endpoints.MLS_KEY_PACKAGES, {
				body: {
					device_id: this.deviceId!,
					key_packages: packages,
				},
			});

			// Also publish mapped under accountId for single-lookup compatibility
			if (this.accountId && this.deviceId !== this.accountId) {
				const fallbackPackages: Array<string> = [];
				for (let i = 0; i < count; i++) {
					const kp = session.generateKeyPackage();
					fallbackPackages.push(bytesToBase64(kp));
				}
				await http.post<MlsKeyPackagesPublishResponse>(Endpoints.MLS_KEY_PACKAGES, {
					body: {
						device_id: this.accountId,
						key_packages: fallbackPackages,
					},
				});
			}

			logger.info('Published initial MLS KeyPackages', {published: res.body.published});
			return res.body.published;
		} catch (error) {
			logger.warn('Failed to publish MLS KeyPackages', error);
			return 0;
		}
	}

	createRecoveryKeyBackup(secret: Uint8Array): Uint8Array {
		if (!this.identityKey) {
			throw new Error('MLS IdentityKey not initialized');
		}
		const bundle = this.identityKey.createAccountKeyBundle();
		return RecoveryKit.encryptBundle(secret, bundle);
	}

	checkTofuForGroup(group: MlsGroupSession): void {
		try {
			const members = group.getMembers();
			tofuKeyManager.checkGroupMembers(members);
		} catch (error) {
			logger.warn('Failed to check TOFU keys for MLS group members', error);
		}
	}

	async getOrCreateGroupSession(
		channelId: string,
		recipientUserIds: ReadonlyArray<string> = [],
	): Promise<MlsGroupSession> {
		const cached = this.activeGroups.get(channelId);
		if (cached) {
			return cached;
		}

		const device = this.getDeviceSession();
		const groupIdBytes = new TextEncoder().encode(channelId);

		let existingGroup: MlsGroupResponse | null = null;
		try {
			const res = await http.get<MlsGroupResponse>(Endpoints.MLS_GROUP(channelId));
			existingGroup = res.body;
		} catch (error) {
			if (!(error instanceof HttpError && error.status === 404)) {
				throw error;
			}
		}

		if (!existingGroup) {
			// Register group on server
			await http.post<MlsGroupResponse>(Endpoints.MLS_GROUPS, {
				body: {group_id: channelId},
			});

			const group = MlsGroupSession.create(device, groupIdBytes);

			// Add each recipient
			for (const recipientId of recipientUserIds) {
				if (recipientId === this.accountId) continue;
				try {
					await this.addMemberToSession(group, channelId, recipientId);
				} catch (err) {
					logger.warn('Failed to add recipient to new MLS group', {recipientId, error: err});
				}
			}

			this.checkTofuForGroup(group);
			this.activeGroups.set(channelId, group);
			return group;
		}

		if (existingGroup.current_epoch === 0) {
			// Group was registered but has no commits or welcomes yet (epoch 0).
			// Do not query welcome for epoch 0. Create local session and add recipients.
			const group = MlsGroupSession.create(device, groupIdBytes);
			for (const recipientId of recipientUserIds) {
				if (recipientId === this.accountId) continue;
				try {
					await this.addMemberToSession(group, channelId, recipientId);
				} catch (err) {
					logger.warn('Failed to add member to MLS group at epoch 0', {recipientId, error: err});
				}
			}
			this.checkTofuForGroup(group);
			this.activeGroups.set(channelId, group);
			return group;
		}

		// Group exists on server with epoch > 0: fetch latest welcome to join
		try {
			const welcomeRes = await http.get<MlsWelcomeDetailResponse>(
				Endpoints.MLS_WELCOME(channelId, existingGroup.current_epoch),
			);
			const welcomeBytes = base64ToBytes(welcomeRes.body.welcome);
			const group = MlsGroupSession.joinFromWelcome(device, welcomeBytes);
			this.checkTofuForGroup(group);
			this.activeGroups.set(channelId, group);
			return group;
		} catch (error) {
			logger.warn('Could not join from Welcome, falling back to local group create', error);
			const group = MlsGroupSession.create(device, groupIdBytes);
			for (const recipientId of recipientUserIds) {
				if (recipientId === this.accountId) continue;
				try {
					await this.addMemberToSession(group, channelId, recipientId);
				} catch (err) {
					logger.warn('Failed to add recipient during local group fallback', {recipientId, error: err});
				}
			}
			this.checkTofuForGroup(group);
			this.activeGroups.set(channelId, group);
			return group;
		}
	}

	private async addMemberToSession(
		group: MlsGroupSession,
		channelId: string,
		recipientId: string,
		maxRetries = 3,
	): Promise<void> {
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const claimRes = await http.post<MlsClaimKeyPackageResponse>(Endpoints.MLS_CLAIM_KEY_PACKAGE(recipientId));
			const kpBytes = base64ToBytes(claimRes.body.key_package);

			const addResult = group.addMember(kpBytes);
			try {
				await http.post<MlsCommitResponse>(Endpoints.MLS_COMMITS(channelId), {
					body: {
						epoch: Number(addResult.epoch),
						commit: bytesToBase64(addResult.commit),
						welcome: bytesToBase64(addResult.welcome),
					},
				});
				this.checkTofuForGroup(group);
				return;
			} catch (error) {
				if (error instanceof HttpError && error.status === 409 && attempt < maxRetries - 1) {
					logger.warn('Commit conflict on addMember, syncing latest commit to retry', {
						attempt,
						channelId,
					});
					const latestCommitRes = await http.get<{commit: string}>(
						Endpoints.MLS_COMMIT(channelId, Number(addResult.epoch)),
					);
					const commitBytes = base64ToBytes(latestCommitRes.body.commit);
					group.processMessage(commitBytes);
					continue;
				}
				throw error;
			}
		}
	}

	async addMember(channelId: string, recipientId: string): Promise<void> {
		const group = await this.getOrCreateGroupSession(channelId);
		await this.addMemberToSession(group, channelId, recipientId);
	}

	async removeMember(channelId: string, leafIndex: number, maxRetries = 3): Promise<void> {
		const group = await this.getOrCreateGroupSession(channelId);

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const commitBytes = group.removeMember(leafIndex);
			const nextEpoch = Number(group.getEpoch());

			try {
				await http.post<MlsCommitResponse>(Endpoints.MLS_COMMITS(channelId), {
					body: {
						epoch: nextEpoch,
						commit: bytesToBase64(commitBytes),
					},
				});
				return;
			} catch (error) {
				if (error instanceof HttpError && error.status === 409 && attempt < maxRetries - 1) {
					logger.warn('Commit conflict on removeMember, syncing latest commit to retry', {
						attempt,
						channelId,
					});
					const latestCommitRes = await http.get<{commit: string}>(Endpoints.MLS_COMMIT(channelId, nextEpoch));
					const latestBytes = base64ToBytes(latestCommitRes.body.commit);
					group.processMessage(latestBytes);
					continue;
				}
				throw error;
			}
		}
	}

	async encryptOnly(
		channelId: string,
		plaintext: string,
		recipientUserIds: ReadonlyArray<string> = [],
	): Promise<{ciphertext: string; epoch: number}> {
		if (tofuKeyManager.hasUnacknowledgedKeyChange(recipientUserIds)) {
			throw new Error(
				'Cannot send message: A contact identity key has changed. You must verify and acknowledge the new key before sending messages.',
			);
		}

		const group = await this.getOrCreateGroupSession(channelId, recipientUserIds);
		const ptBytes = new TextEncoder().encode(plaintext);
		const ciphertextBytes = group.encryptMessage(ptBytes);
		const ciphertextBase64 = bytesToBase64(ciphertextBytes);
		const epoch = Number(group.getEpoch());
		return {
			ciphertext: ciphertextBase64,
			epoch,
		};
	}

	async encryptMessage(
		channelId: string,
		plaintext: string,
		recipientUserIds: ReadonlyArray<string> = [],
	): Promise<{message_id: string; ciphertext: string; epoch: number}> {
		const {ciphertext, epoch} = await this.encryptOnly(channelId, plaintext, recipientUserIds);
		const messageId = String(Date.now());

		const res = await http.post<MlsCiphertextMessageResponse>(Endpoints.MLS_MESSAGES(channelId), {
			body: {
				message_id: messageId,
				epoch,
				ciphertext,
			},
		});

		return {
			message_id: res.body.message_id,
			ciphertext,
			epoch,
		};
	}

	async sendApplicationMessage(
		channelId: string,
		payload: MlsApplicationPayload,
		recipientUserIds: ReadonlyArray<string> = [],
	): Promise<{message_id: string; ciphertext: string; epoch: number}> {
		const plaintext = formatMlsApplicationPayload(payload);
		return this.encryptMessage(channelId, plaintext, recipientUserIds);
	}

	async deleteCiphertext(channelId: string, messageId: string): Promise<void> {
		try {
			await http.delete(Endpoints.MLS_MESSAGE(channelId, messageId));
		} catch (error) {
			logger.warn(`Failed to delete ciphertext for message ${messageId} in channel ${channelId}`, error);
		}
	}

	async decryptMessage(
		channelId: string,
		ciphertextBase64: string,
		recipientUserIds: ReadonlyArray<string> = [],
	): Promise<string> {
		const group = await this.getOrCreateGroupSession(channelId, recipientUserIds);
		const ctBytes = base64ToBytes(ciphertextBase64);
		const processed = group.processMessage(ctBytes);

		if (processed.type === 'application') {
			return new TextDecoder().decode(processed.plaintext);
		}
		if (processed.type === 'commit') {
			this.checkTofuForGroup(group);
		}
		return '';
	}

	async fetchCiphertextHistory(
		channelId: string,
		memberJoinEpoch = 0,
		before?: string,
		limit = 50,
	): Promise<Array<{message_id: string; epoch: number; content: string; created_at: string}>> {
		const res = await http.get<{
			messages: Array<{
				message_id: string;
				epoch: number;
				ciphertext: string;
				created_at: string;
				expires_at: string;
			}>;
		}>(Endpoints.MLS_MESSAGES(channelId), {
			query: {
				member_join_epoch: memberJoinEpoch,
				before,
				limit,
			},
		});

		const results: Array<{message_id: string; epoch: number; content: string; created_at: string}> = [];
		for (const msg of res.body.messages) {
			let content = '';
			try {
				content = await this.decryptMessage(channelId, msg.ciphertext);
			} catch (e) {
				logger.warn('Failed to decrypt scrollback ciphertext', e);
			}
			results.push({
				message_id: msg.message_id,
				epoch: msg.epoch,
				content,
				created_at: msg.created_at,
			});
		}
		return results;
	}
}

export const mlsClientManager = MlsClientManager.getInstance();
