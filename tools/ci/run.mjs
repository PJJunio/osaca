#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

process.env.TOKIO_WORKER_THREADS ??= '4';
process.env.RAYON_NUM_THREADS ??= '4';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, 'Cargo.toml');

let cmd = 'cargo';
let args;

if (process.env.OSACA_CI_BIN) {
	cmd = process.env.OSACA_CI_BIN;
	args = process.argv.slice(2);
} else {
	args = ['run', '--quiet', '--manifest-path', manifestPath, '--', ...process.argv.slice(2)];
}

const child = spawn(cmd, args, {
	stdio: 'inherit',
	windowsHide: true,
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
	} else {
		process.exit(code ?? 0);
	}
});
