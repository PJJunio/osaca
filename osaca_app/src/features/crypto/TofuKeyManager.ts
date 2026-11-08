// SPDX-License-Identifier: AGPL-3.0-or-later

import AppStorage from '@app/features/platform/state/PersistentStorage';
import {Logger} from '@app/features/platform/utils/AppLogger';
import {
	type IdentityKey,
	type SafetyNumber,
	type TofuContactRecord,
	TofuIdentityStore,
	type TofuRecordStatus,
	type TofuStorage,
} from '@osaca/crypto';
import {makeAutoObservable, runInAction} from 'mobx';

const logger = new Logger('TofuKeyManager');

class AppTofuStorage implements TofuStorage {
	getItem(key: string): string | null {
		return AppStorage.getItem(key);
	}

	setItem(key: string, value: string): void {
		AppStorage.setItem(key, value);
	}

	removeItem(key: string): void {
		AppStorage.removeItem(key);
	}
}

export class TofuKeyManager {
	private static instance: TofuKeyManager | null = null;
	private store: TofuIdentityStore | null = null;
	private localAccountId: string | null = null;
	// Observable revision counter so MobX observers re-render when contacts change
	revision = 0;

	constructor() {
		makeAutoObservable(this, {}, {autoBind: true});
	}

	static getInstance(): TofuKeyManager {
		if (!TofuKeyManager.instance) {
			TofuKeyManager.instance = new TofuKeyManager();
		}
		return TofuKeyManager.instance;
	}

	initialize(localAccountId: string): void {
		this.localAccountId = localAccountId;
		this.store = new TofuIdentityStore(localAccountId, new AppTofuStorage());
		runInAction(() => {
			this.revision++;
		});
		logger.info('Initialized TofuKeyManager for account', {localAccountId});
	}

	private getStore(): TofuIdentityStore {
		if (!this.store) {
			const fallbackId = this.localAccountId ?? 'default';
			this.store = new TofuIdentityStore(fallbackId, new AppTofuStorage());
		}
		return this.store;
	}

	recordContactIdentity(
		contactAccountId: string,
		identityKey: Uint8Array | string,
	): {status: TofuRecordStatus; record: TofuContactRecord} {
		const res = this.getStore().recordContactIdentity(contactAccountId, identityKey);
		runInAction(() => {
			this.revision++;
		});
		return res;
	}

	acknowledgeKeyChange(contactAccountId: string): TofuContactRecord | null {
		const res = this.getStore().acknowledgeKeyChange(contactAccountId);
		runInAction(() => {
			this.revision++;
		});
		return res;
	}

	setContactVerified(contactAccountId: string, verified: boolean): TofuContactRecord | null {
		const res = this.getStore().setContactVerified(contactAccountId, verified);
		runInAction(() => {
			this.revision++;
		});
		return res;
	}

	getContactIdentity(contactAccountId: string): TofuContactRecord | null {
		void this.revision;
		return this.getStore().getContact(contactAccountId);
	}

	hasKeyChanged(contactAccountId: string): boolean {
		void this.revision;
		return this.getStore().hasKeyChanged(contactAccountId);
	}

	isVerified(contactAccountId: string): boolean {
		void this.revision;
		return this.getStore().isVerified(contactAccountId);
	}

	hasUnacknowledgedKeyChange(contactAccountIds: ReadonlyArray<string>): boolean {
		void this.revision;
		return this.getStore().hasUnacknowledgedKeyChange(contactAccountIds);
	}

	checkGroupMembers(
		members: Array<{identity: string; signatureKey: Uint8Array}>,
	): Array<{status: TofuRecordStatus; record: TofuContactRecord}> {
		const res = this.getStore().checkGroupMembers(members);
		runInAction(() => {
			this.revision++;
		});
		return res;
	}

	async deriveSafetyNumber(
		contactAccountId: string,
		localIdentityKey: IdentityKey | Uint8Array | string,
	): Promise<SafetyNumber | null> {
		const keyBytes =
			typeof localIdentityKey === 'object' && 'publicKeyBytes' in localIdentityKey
				? localIdentityKey.publicKeyBytes
				: localIdentityKey;
		return this.getStore().deriveSafetyNumber(contactAccountId, keyBytes);
	}
}

export const tofuKeyManager = TofuKeyManager.getInstance();
