// SPDX-License-Identifier: AGPL-3.0-or-later

import {ResettableStates} from '@app/features/app/state/ResettableStates';
import SessionManager from '@app/features/platform/state/AuthSession';
import {User} from '@app/features/user/models/User';
import {shouldShowDiscriminator} from '@app/features/user/utils/UserTagUtils';
import type {UserPrivate, User as WireUser} from '@osaca/schema/src/domains/user/UserResponseSchemas';
import {makeAutoObservable, observableRef, reaction, runInAction} from 'mobx';

const CURRENT_USER_PRIVATE_WIRE_KEYS = [
	'is_staff',
	'account_limited',
	'mfa_enabled',
	'authenticator_types',
	'hidden_profile_badges',
	'password_last_changed_at',
	'last_voice_activity_sharing_change_at',
	'nsfw_allowed',
	'pending_bulk_message_deletion',
	'age_verified_adult',
	'terms_agreed_at',
	'privacy_agreed_at',
	'traits',
	'timezone',
	'timezone_privacy_flags',
] as const;

function isPublicOnlyCurrentUserPayload(user: WireUser): boolean {
	return !CURRENT_USER_PRIVATE_WIRE_KEYS.some((key) => key in user);
}

class CurrentUserHydrationMismatchError extends Error {
	constructor(accountKey: string, userId: string) {
		super(`Cannot hydrate user ${userId} outside its active account ${accountKey}`);
		this.name = 'CurrentUserHydrationMismatchError';
	}
}

class Users {
	users: Record<string, User> = {};
	userCount = 0;
	viewAccountKey: string | null = null;
	private hydratedAccountKey: string | null = null;

	constructor() {
		makeAutoObservable<Users, 'hydratedAccountKey'>(this, {hydratedAccountKey: observableRef}, {autoBind: true});
	}

	get currentUser(): User | null {
		const currentAccountKey = SessionManager.currentAccountKey;
		const currentUserId = SessionManager.userId;
		if (currentAccountKey === null || currentUserId === null || this.hydratedAccountKey !== currentAccountKey) {
			return null;
		}
		return this.users[currentUserId] ?? null;
	}

	get currentUserId(): string | null {
		return SessionManager.userId;
	}

	get isCurrentUserHydrated(): boolean {
		const currentAccountKey = SessionManager.currentAccountKey;
		const currentUserId = SessionManager.userId;
		return (
			currentAccountKey !== null &&
			currentUserId !== null &&
			this.hydratedAccountKey === currentAccountKey &&
			this.users[currentUserId] !== undefined
		);
	}

	get usersList(): ReadonlyArray<User> {
		return Object.values(this.users);
	}

	getUser(userId: string): User | undefined {
		if (userId === this.currentUserId) {
			return this.currentUser ?? undefined;
		}
		return this.users[userId];
	}

	getCurrentUser(): User | undefined {
		return this.currentUser ?? undefined;
	}

	getUserByTag(tag: string): User | undefined {
		const bareName = tag.toLowerCase();
		return this.usersList.find(
			(user) =>
				user.tag === tag ||
				`${user.username}#${user.discriminator}` === tag ||
				(!shouldShowDiscriminator(user) && user.username.toLowerCase() === bareName),
		);
	}

	getUsers(): ReadonlyArray<User> {
		return this.usersList;
	}

	handleGatewayReady(accountKey: string, currentUser: UserPrivate): void {
		this.assertCurrentAccountIdentity(accountKey, currentUser.id);
		const userRecord = new User(currentUser);
		this.users = {
			[currentUser.id]: userRecord,
		};
		this.userCount = 1;
		this.hydratedAccountKey = accountKey;
		this.viewAccountKey = accountKey;
	}

	hydrateFromSnapshot(accountKey: string, currentUser: UserPrivate, users: ReadonlyArray<WireUser>): void {
		this.assertCurrentAccountIdentity(accountKey, currentUser.id);
		const hydratedUsers: Record<string, User> = {
			[currentUser.id]: new User(currentUser),
		};
		for (const user of users) {
			if (user.id !== currentUser.id) {
				hydratedUsers[user.id] = new User(user);
			}
		}
		this.users = hydratedUsers;
		this.userCount = Object.keys(hydratedUsers).length;
		this.hydratedAccountKey = accountKey;
		this.viewAccountKey = accountKey;
	}

	resetAccountState(): void {
		this.users = {};
		this.userCount = 0;
		this.hydratedAccountKey = null;
	}

	handleUserUpdate(
		user: WireUser,
		options?: {
			clearMissingOptionalFields?: boolean;
		},
	): void {
		const existingUser = this.users[user.id];
		if (
			user.id === this.currentUserId &&
			existingUser &&
			options?.clearMissingOptionalFields !== true &&
			isPublicOnlyCurrentUserPayload(user)
		) {
			return;
		}
		this.storeUser(existingUser, existingUser ? existingUser.withUpdates(user, options) : new User(user));
	}

	private storeUser(existingUser: User | undefined, nextUser: User): void {
		if (existingUser) {
			if (existingUser.equals(nextUser)) {
				return;
			}
		} else {
			this.userCount += 1;
		}
		this.users[nextUser.id] = nextUser;
	}

	cacheUsers(
		users: Array<
			WireUser & {
				globalName?: never;
			}
		>,
	): void {
		runInAction(() => {
			for (const user of users) {
				const existingUser = this.users[user.id];
				if (user.id === this.currentUserId && existingUser && isPublicOnlyCurrentUserPayload(user)) {
					continue;
				}
				this.storeUser(existingUser, existingUser ? existingUser.withUpdates(user) : new User(user));
			}
		});
	}

	subscribe(callback: () => void): () => void {
		return reaction(
			() => this.userCount,
			() => callback(),
			{fireImmediately: true},
		);
	}

	private assertCurrentAccountIdentity(accountKey: string, userId: string): void {
		if (SessionManager.currentAccountKey !== accountKey || SessionManager.userId !== userId) {
			throw new CurrentUserHydrationMismatchError(accountKey, userId);
		}
	}
}

const users = new Users();
ResettableStates.register(users, users.resetAccountState);

export default users;
