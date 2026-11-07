// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
	CassandraParams,
	KvAdvance,
	KvQueryMeta,
	PreparedQuery,
	QueryTemplate,
} from '@app/api/database/CassandraTypes';
import {
	assertNoUndefinedParams,
	getStatementMeta,
	isConditionalQuery,
	normalizeExecuteArgs,
	normalizeInParams,
} from '@app/api/database/CassandraTypes';
import {chunkArray} from '@app/api/utils/ArrayUtils';

const DEFAULT_MAX_PARTITION_KEYS_PER_QUERY = 100;

export interface CassandraQueryExecutorForTesting {
	executeQuery<T = Record<string, unknown>, P extends CassandraParams = CassandraParams>(
		query: PreparedQuery<P>,
	): Promise<Array<T>>;
	executePagedQuery?<T = Record<string, unknown>, P extends CassandraParams = CassandraParams>(
		query: PreparedQuery<P>,
		options: {
			pageSize: number;
			pageState?: string | null;
		},
	): Promise<PagedQueryResult<T>>;
	executeBatch(queries: Array<{query: string; params: object; meta?: KvQueryMeta}>, atomic?: boolean): Promise<void>;
	advanceRows?(writes: ReadonlyArray<KvAdvance>): Promise<Array<boolean>>;
	reset?(): void;
	shutdown?(): Promise<void>;
}

let injectedExecutorForTesting: CassandraQueryExecutorForTesting | null = null;
let configuredExecutor: CassandraQueryExecutorForTesting | null = null;

function activeExecutor(): CassandraQueryExecutorForTesting | null {
	return injectedExecutorForTesting ?? configuredExecutor;
}

function requireExecutor(): CassandraQueryExecutorForTesting {
	const executor = activeExecutor();
	if (!executor) {
		throw new Error('Database query executor is not initialized');
	}
	return executor;
}

export function setDatabaseQueryExecutor(executor: CassandraQueryExecutorForTesting | null): void {
	configuredExecutor = executor;
}

export function hasDatabaseQueryExecutor(): boolean {
	return activeExecutor() !== null;
}

export function setCassandraQueryExecutorForTesting(executor: CassandraQueryExecutorForTesting | null): void {
	injectedExecutorForTesting = executor;
}

export function resetCassandraQueryExecutorForTesting(): void {
	injectedExecutorForTesting?.reset?.();
}

export async function shutdownCassandraQueryExecutorForTesting(): Promise<void> {
	await injectedExecutorForTesting?.shutdown?.();
	injectedExecutorForTesting = null;
}

export interface PagedQueryResult<T> {
	rows: Array<T>;
	pageState: string | null;
}

interface CassandraReadOptions {
	consistency: 'all' | 'serial' | 'localQuorum';
}

export async function executeQuery<T = Record<string, unknown>, P extends CassandraParams = CassandraParams>(
	queryOrPrepared: string | PreparedQuery<P>,
	params?: P,
	readOptions?: CassandraReadOptions,
): Promise<Array<T>> {
	const {cql, params: boundRaw} = normalizeExecuteArgs(queryOrPrepared, params);
	const meta = getStatementMeta(cql);
	const bound = normalizeInParams(meta, boundRaw);
	if (meta.unsafe) {
		throw new Error('Cannot prepare a statement that looks like `SELECT *`');
	}
	if (readOptions && meta.type !== 'SELECT') {
		throw new Error('Read consistency options require a SELECT query');
	}
	assertNoUndefinedParams(bound as Record<string, unknown>);
	return requireExecutor().executeQuery<T, P>({
		cql,
		params: bound as P,
		kvMeta: typeof queryOrPrepared === 'string' ? undefined : queryOrPrepared.kvMeta,
	});
}

export async function executeConditional(query: PreparedQuery): Promise<boolean> {
	if (!isConditionalQuery(query)) {
		throw new Error('executeConditional requires a conditional query');
	}
	const rows = await executeQuery(query);
	const applied = rows[0]?.['[applied]'];
	const isBatch = query.kvMeta?.action === 'batch';
	if (
		typeof applied !== 'boolean' ||
		(!isBatch && rows.length !== 1) ||
		rows.some((row) => row['[applied]'] !== applied)
	) {
		throw new Error('Conditional write returned an invalid database result');
	}
	return applied;
}

export async function fetchOne<T = Record<string, unknown>, P extends CassandraParams = CassandraParams>(
	queryOrPrepared: PreparedQuery<P> | string,
	params?: P,
): Promise<T | null> {
	const [row] = await executeQuery<T, P>(queryOrPrepared, params);
	return row ?? null;
}

export async function fetchMany<T = Record<string, unknown>, P extends CassandraParams = CassandraParams>(
	queryOrPrepared: PreparedQuery<P> | string,
	params?: P,
	readOptions?: CassandraReadOptions,
): Promise<Array<T>> {
	return executeQuery<T, P>(queryOrPrepared, params, readOptions);
}

export async function fetchPage<T = Record<string, unknown>, P extends CassandraParams = CassandraParams>(
	queryOrPrepared: PreparedQuery<P> | string,
	params: P | undefined,
	options: {
		pageSize: number;
		pageState?: string | null;
	},
): Promise<PagedQueryResult<T>> {
	const {cql, params: boundRaw} = normalizeExecuteArgs(queryOrPrepared, params);
	const meta = getStatementMeta(cql);
	const bound = normalizeInParams(meta, boundRaw);
	if (meta.unsafe) {
		throw new Error('Cannot prepare a statement that looks like `SELECT *`');
	}
	assertNoUndefinedParams(bound as Record<string, unknown>);
	const executor = requireExecutor();
	const preparedQuery = {
		cql,
		params: bound as P,
		kvMeta: typeof queryOrPrepared === 'string' ? undefined : queryOrPrepared.kvMeta,
	};
	if (executor.executePagedQuery) {
		return executor.executePagedQuery<T, P>(preparedQuery, options);
	}
	const rows = await executor.executeQuery<T, P>(preparedQuery);
	return {
		rows: rows.slice(0, options.pageSize),
		pageState: null,
	};
}

export async function fetchManyInChunks<
	T = Record<string, unknown>,
	V = unknown,
	P extends CassandraParams = CassandraParams,
>(
	query: QueryTemplate<P> | PreparedQuery<P> | string,
	values: Array<V>,
	paramsFactory: (chunk: Array<V>) => P,
	chunkSize = DEFAULT_MAX_PARTITION_KEYS_PER_QUERY,
): Promise<Array<T>> {
	if (values.length === 0) return [];
	const chunks = chunkArray(values, chunkSize);
	const results = await Promise.all(
		chunks.map(async (chunk) => {
			const params = paramsFactory(chunk);
			if (typeof query === 'string') {
				return executeQuery<T, P>(query, params);
			}
			if ((query as PreparedQuery<P>).params !== undefined) {
				return executeQuery<T, P>(query as PreparedQuery<P>);
			}
			return executeQuery<T, P>((query as QueryTemplate<P>).bind(params));
		}),
	);
	return results.flat();
}

export async function advanceRows(
	writes: ReadonlyArray<KvAdvance>,
	readThenWrite: () => Promise<Array<boolean>>,
): Promise<Array<boolean>> {
	if (writes.length === 0) return [];
	const executor = activeExecutor();
	return executor?.advanceRows ? executor.advanceRows(writes) : readThenWrite();
}

export async function advanceRow(write: KvAdvance, readThenWrite: () => Promise<boolean>): Promise<boolean> {
	const [written] = await advanceRows([write], async () => [await readThenWrite()]);
	return written === true;
}

export async function upsertOne<P extends CassandraParams = CassandraParams>(
	queryOrPrepared: PreparedQuery<P> | string,
	params?: P,
): Promise<void> {
	assertUnconditional(normalizeExecuteArgs(queryOrPrepared, params));
	await executeQuery(queryOrPrepared, params);
}

export async function deleteOneOrMany<P extends CassandraParams = CassandraParams>(
	queryOrPrepared: PreparedQuery<P> | string,
	params?: P,
): Promise<void> {
	assertUnconditional(normalizeExecuteArgs(queryOrPrepared, params));
	await executeQuery(queryOrPrepared, params);
}

function assertUnconditional(query: PreparedQuery): void {
	if (isConditionalQuery(query)) {
		throw new Error('Conditional writes must use executeConditional to preserve their result');
	}
}

interface BatchQuery {
	query: string;
	params: object;
	meta?: KvQueryMeta;
}

async function executeBatch(
	queries: Array<BatchQuery>,
	atomic = true,
	_consistency?: CassandraReadOptions['consistency'],
): Promise<void> {
	if (queries.length === 0) return;
	for (const {query, params, meta} of queries) {
		assertUnconditional({cql: query, params: params as CassandraParams, kvMeta: meta});
		if (getStatementMeta(query).unsafe) {
			throw new Error('Cannot prepare a statement that looks like `SELECT *`');
		}
	}
	for (const {params} of queries) {
		assertNoUndefinedParams(params as Record<string, unknown>);
	}
	await requireExecutor().executeBatch(queries, atomic);
}

export class BatchBuilder {
	private queries: Array<BatchQuery> = [];

	add(query: string, params: object, meta?: KvQueryMeta): this {
		this.queries.push({query, params, meta});
		return this;
	}

	addPrepared(q: PreparedQuery): this {
		this.queries.push({query: q.cql, params: q.params, meta: q.kvMeta});
		return this;
	}

	async execute(atomic = true, consistency?: CassandraReadOptions['consistency']): Promise<void> {
		if (this.queries.length === 0) return;
		await executeBatch(this.queries, atomic, consistency);
	}

	async executeChunked(chunkSize: number, atomic = false): Promise<void> {
		if (this.queries.length === 0) return;
		for (let i = 0; i < this.queries.length; i += chunkSize) {
			await executeBatch(this.queries.slice(i, i + chunkSize), atomic);
		}
	}
}

const MAX_BATCH_STATEMENTS = 60;

export async function executeGroupedBatches(
	groups: ReadonlyArray<ReadonlyArray<PreparedQuery>>,
	maxStatements = MAX_BATCH_STATEMENTS,
): Promise<void> {
	let batch = new BatchBuilder();
	let size = 0;
	for (const group of groups) {
		if (size > 0 && size + group.length > maxStatements) {
			await batch.execute();
			batch = new BatchBuilder();
			size = 0;
		}
		for (const query of group) batch.addPrepared(query);
		size += group.length;
	}
	await batch.execute();
}
