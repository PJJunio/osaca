// SPDX-License-Identifier: AGPL-3.0-or-later

import {executeGroupedBatches, setCassandraQueryExecutorForTesting} from '@app/api/database/CassandraQueryExecution';
import {prepared} from '@app/api/database/CassandraTypes';
import {afterEach, describe, expect, it} from 'vitest';

describe('executeGroupedBatches', () => {
	afterEach(() => {
		setCassandraQueryExecutorForTesting(null);
	});

	function recordBatches(): Array<Array<string>> {
		const batches: Array<Array<string>> = [];
		setCassandraQueryExecutorForTesting({
			executeQuery: async () => [],
			executeBatch: async (queries) => {
				batches.push(queries.map((query) => (query.params as {id: string}).id));
			},
		});
		return batches;
	}

	function group(id: number, size: number) {
		return Array.from({length: size}, (_, index) => prepared('DELETE FROM t WHERE id = ?', {id: `${id}.${index}`}));
	}

	it('keeps every group in one batch and never exceeds the statement limit', async () => {
		const batches = recordBatches();
		await executeGroupedBatches(
			Array.from({length: 10}, (_, id) => group(id, 3)),
			7,
		);
		expect(batches.map((batch) => batch.length)).toEqual([6, 6, 6, 6, 6]);
		for (const batch of batches) {
			const groups = new Set(batch.map((id) => id.split('.')[0]));
			for (const id of groups) {
				expect(batch.filter((entry) => entry.startsWith(`${id}.`))).toHaveLength(3);
			}
		}
	});

	it('sends nothing for no groups', async () => {
		const batches = recordBatches();
		await executeGroupedBatches([]);
		expect(batches).toEqual([]);
	});
});
