// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';
import {DeviceSession, ensureCryptoWasmReady} from '@osaca/crypto';
import pg from 'pg';

ensureCryptoWasmReady();

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL || 'postgres://osaca:osaca@127.0.0.1:5432/osaca',
});

const users = ['1569475910086688768', '1569476742081413120'];

for (const userId of users) {
	const dev = DeviceSession.create(userId, `dev_${userId}`);
	for (let i = 0; i < 10; i++) {
		const kpBytes = dev.generateKeyPackage();
		const b64 = Buffer.from(kpBytes).toString('base64');
		const hash = createHash('sha256').update(b64).digest('hex');
		await pool.query(
			`INSERT INTO mls_key_packages (key_package_hash, device_id, key_package_bytes, created_at)
			 VALUES ($1, $2, decode($3, 'base64'), now())
			 ON CONFLICT (key_package_hash) DO NOTHING;`,
			[hash, userId, b64],
		);
	}
}

const res = await pool.query('SELECT device_id, count(*) FROM mls_key_packages GROUP BY device_id;');
console.log('Key packages seeded:', res.rows);
await pool.end();
