import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const token = randomBytes(32).toString('hex');
const env = { ...process.env, PENSIEVE_LOCAL_TOKEN: token, VITE_LOCAL_TOKEN: token,
  VITE_LOCAL_MODE: 'true', VITE_API_BASE_URL: '/api', BACKEND_URL: 'http://127.0.0.1:3002',
  PENSIEVE_DATA_DIR: resolve(process.env.PENSIEVE_DATA_DIR || resolve(root, '.pensieve/memories')) };
const children = [
  spawn(process.execPath, [resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'backend/src/localIndex.ts'], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { cwd: resolve(root, 'frontend'), env, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = code;
}
children.forEach(child => { child.on('exit', code => stop(code ?? 0)); child.on('error', error => { console.error(error.message); stop(1); }); });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
console.log('Pensieve local: http://127.0.0.1:5175 — local storage; cloud AI requires opt-in');
