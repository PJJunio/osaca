// SPDX-License-Identifier: AGPL-3.0-or-later

import {uint8ArrayToHex} from './attachment.js';
import {deriveSafetyNumber, type SafetyNumber} from './safety_number.js';

export type TofuRecordStatus = 'first_seen' | 'trusted' | 'key_changed';

export interface TofuContactRecord {
	accountId: string;
	identityKeyHex: string;
	firstSeenAt: number;
	lastSeenAt: number;
	verified: boolean;
	verifiedAt?: number;
	keyChanged?: boolean;
	pendingKeyHex?: string;
	previousKeys?: Array<{
		identityKeyHex: string;
		retiredAt: number;
	}>;
}

export interface TofuStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem?(key: string): void;
}

export class MemoryTofuStorage implements TofuStorage {
	private store = new Map<string, string>();

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}
}

/**
 * Trust-On-First-Use (TOFU) Identity Key tracking and persistence store.
 * Tracks contact identity keys, detects key changes, enforces explicit user
 * acknowledgement before trusting changed keys, and coordinates Safety Number derivation.
 */
export class TofuIdentityStore {
	private readonly storage: TofuStorage;
	private readonly localAccountId: string;
	private readonly contacts = new Map<string, TofuContactRecord>();

	constructor(localAccountId: string, storage: TofuStorage = new MemoryTofuStorage()) {
		this.localAccountId = localAccountId;
		this.storage = storage;
		this.load();
	}

	private getStorageKey(): string {
		return `osaca:mls:tofu:${this.localAccountId}`;
	}

	private load(): void {
		try {
			const raw = this.storage.getItem(this.getStorageKey());
			if (raw) {
				const data = JSON.parse(raw) as Record<string, TofuContactRecord>;
				this.contacts.clear();
				for (const [id, rec] of Object.entries(data)) {
					this.contacts.set(id, rec);
				}
			}
		} catch {
			// ignore corrupted storage
		}
	}

	private save(): void {
		try {
			const obj: Record<string, TofuContactRecord> = {};
			for (const [id, rec] of this.contacts.entries()) {
				obj[id] = rec;
			}
			this.storage.setItem(this.getStorageKey(), JSON.stringify(obj));
		} catch {
			// ignore storage errors
		}
	}

	recordContactIdentity(
		contactAccountId: string,
		identityKey: Uint8Array | string,
	): {status: TofuRecordStatus; record: TofuContactRecord} {
		const cleanHex = typeof identityKey === 'string' ? identityKey.trim().toLowerCase() : uint8ArrayToHex(identityKey);

		const existing = this.contacts.get(contactAccountId);
		const now = Date.now();

		if (!existing) {
			const record: TofuContactRecord = {
				accountId: contactAccountId,
				identityKeyHex: cleanHex,
				firstSeenAt: now,
				lastSeenAt: now,
				verified: false,
				keyChanged: false,
			};
			this.contacts.set(contactAccountId, record);
			this.save();
			return {status: 'first_seen', record};
		}

		if (existing.identityKeyHex === cleanHex) {
			existing.lastSeenAt = now;
			this.save();
			return {status: 'trusted', record: existing};
		}

		// Key mismatch -> Key Change Detected!
		existing.keyChanged = true;
		existing.pendingKeyHex = cleanHex;
		existing.lastSeenAt = now;
		this.save();
		return {status: 'key_changed', record: existing};
	}

	acknowledgeKeyChange(contactAccountId: string): TofuContactRecord | null {
		const existing = this.contacts.get(contactAccountId);
		if (!existing?.keyChanged) {
			return existing ?? null;
		}

		const newKey = existing.pendingKeyHex ?? existing.identityKeyHex;
		const previousKeys = existing.previousKeys ? [...existing.previousKeys] : [];
		previousKeys.push({
			identityKeyHex: existing.identityKeyHex,
			retiredAt: Date.now(),
		});

		existing.identityKeyHex = newKey;
		delete existing.pendingKeyHex;
		existing.keyChanged = false;
		existing.verified = false; // Reset verification when identity key changes
		delete existing.verifiedAt;
		existing.lastSeenAt = Date.now();
		existing.previousKeys = previousKeys;

		this.save();
		return existing;
	}

	setContactVerified(contactAccountId: string, verified: boolean): TofuContactRecord | null {
		const existing = this.contacts.get(contactAccountId);
		if (!existing) {
			return null;
		}

		existing.verified = verified;
		existing.verifiedAt = verified ? Date.now() : undefined;
		this.save();
		return existing;
	}

	getContact(contactAccountId: string): TofuContactRecord | null {
		return this.contacts.get(contactAccountId) ?? null;
	}

	hasKeyChanged(contactAccountId: string): boolean {
		return this.contacts.get(contactAccountId)?.keyChanged === true;
	}

	isVerified(contactAccountId: string): boolean {
		return this.contacts.get(contactAccountId)?.verified === true;
	}

	hasUnacknowledgedKeyChange(contactAccountIds: ReadonlyArray<string>): boolean {
		return contactAccountIds.some((id) => this.hasKeyChanged(id));
	}

	checkGroupMembers(
		members: Array<{identity: string; signatureKey: Uint8Array}>,
	): Array<{status: TofuRecordStatus; record: TofuContactRecord}> {
		const results: Array<{status: TofuRecordStatus; record: TofuContactRecord}> = [];
		for (const member of members) {
			if (!member.identity) continue;
			if (member.identity === this.localAccountId || member.identity.startsWith(`${this.localAccountId}:`)) {
				continue;
			}
			const accountId = member.identity.split(':')[0];
			results.push(this.recordContactIdentity(accountId, member.signatureKey));
		}
		return results;
	}

	async deriveSafetyNumber(
		contactAccountId: string,
		localIdentityKey: Uint8Array | string,
	): Promise<SafetyNumber | null> {
		const contact = this.getContact(contactAccountId);
		if (!contact) {
			return null;
		}
		const contactKey = contact.keyChanged && contact.pendingKeyHex ? contact.pendingKeyHex : contact.identityKeyHex;

		return deriveSafetyNumber(
			{
				accountId: this.localAccountId,
				publicKey: localIdentityKey,
			},
			{
				accountId: contactAccountId,
				publicKey: contactKey,
			},
		);
	}
}
