// SPDX-License-Identifier: AGPL-3.0-or-later

import {Logger} from '@app/api/Logger';
import type {IAuditLogSearchService} from '@app/api/search/IAuditLogSearchService';
import type {IGuildMemberSearchService} from '@app/api/search/IGuildMemberSearchService';
import type {IGuildSearchService} from '@app/api/search/IGuildSearchService';
import type {IMessageSearchService} from '@app/api/search/IMessageSearchService';
import type {IReportSearchService} from '@app/api/search/IReportSearchService';
import type {ISearchProvider} from '@app/api/search/ISearchProvider';
import type {IThreadSearchService} from '@app/api/search/IThreadSearchService';
import type {IUserSearchService} from '@app/api/search/IUserSearchService';
import {InMemorySearchProvider} from '@app/api/test/search/InMemorySearchProvider';
import {getDefaultPostgresClient, type IPostgresClient} from '@pkgs/postgres/src/Client';

let searchProvider: ISearchProvider | null = null;
let injectedSearchProvider: ISearchProvider | undefined;

function tryGetPostgresClient(): IPostgresClient | undefined {
	try {
		return getDefaultPostgresClient();
	} catch {
		return undefined;
	}
}

function createSearchProvider(): ISearchProvider {
	Logger.info('Using Postgres-backed search provider');
	return new InMemorySearchProvider(tryGetPostgresClient());
}

export function setInjectedSearchProvider(provider: ISearchProvider | undefined): void {
	injectedSearchProvider = provider;
	searchProvider = provider ?? null;
}

export function getMessageSearchService(): IMessageSearchService | null {
	return searchProvider?.getMessageSearchService() ?? null;
}

export function getGuildSearchService(): IGuildSearchService | null {
	return searchProvider?.getGuildSearchService() ?? null;
}

export function getUserSearchService(): IUserSearchService | null {
	return searchProvider?.getUserSearchService() ?? null;
}

export function getReportSearchService(): IReportSearchService | null {
	return searchProvider?.getReportSearchService() ?? null;
}

export function getAuditLogSearchService(): IAuditLogSearchService | null {
	return searchProvider?.getAuditLogSearchService() ?? null;
}

export function getGuildMemberSearchService(): IGuildMemberSearchService | null {
	return searchProvider?.getGuildMemberSearchService() ?? null;
}

export function getThreadSearchService(): IThreadSearchService | null {
	return searchProvider?.getThreadSearchService() ?? null;
}

export async function initializeSearch(): Promise<void> {
	if (searchProvider) {
		await shutdownSearch();
	}
	const injectedProvider = injectedSearchProvider;
	if (injectedProvider) {
		searchProvider = injectedProvider;
		Logger.info('Using injected search provider (in-process mode)');
		await searchProvider.initialize();
		return;
	}
	const provider = createSearchProvider();
	try {
		await provider.initialize();
	} catch (error) {
		Logger.error({error}, 'Search backend initialisation failed');
		try {
			await provider.shutdown();
		} catch (shutdownError) {
			Logger.warn({error: shutdownError}, 'Failed to shut down search provider after initialisation failure');
		}
		throw error;
	}
	searchProvider = provider;
	Logger.info('Search backend initialized successfully');
}

export async function shutdownSearch(): Promise<void> {
	if (searchProvider) {
		await searchProvider.shutdown();
		searchProvider = null;
	}
}
