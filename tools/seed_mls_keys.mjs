// SPDX-License-Identifier: AGPL-3.0-or-later
import {createHash} from 'node:crypto';
import {DeviceSession, ensureCryptoWasmReady} from '../packages/osaca_crypto/src/index.ts';

ensureCryptoWasmReady();

const users = ['1569475910086688768', '1569476742081413120'];

for (const userId of users) {
	const dev = DeviceSession.create(userId, `dev_${userId}`);
	for (let i = 0; i < 10; i++) {
		const kpBytes = dev.generateKeyPackage();
		const b64 = Buffer.from(kpBytes).toString('base64');
		const hash = createHash('sha256').update(b64).digest('hex');
		console.log(
			`INSERT INTO mls_key_packages (key_package_hash, device_id, key_package_bytes, created_at) VALUES ('${hash}', '${userId}', decode('${b64}', 'base64'), now()) ON CONFLICT (key_package_hash) DO NOTHING;`,
		);
	}
}
