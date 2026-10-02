import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, runtimeFile, frontendPort, backendPort, url, prepareRuntime, readRuntime, alive, requireFreePort } from './local-runtime.mjs';
await prepareRuntime();
const previous = await readRuntime();
if (previous && alive(previous.pid)) throw new Error('Pensieve 已在运行。使用 npm run start:local 打开，或 npm run stop:local 停止。');
await requireFreePort(frontendPort);
await requireFreePort(backendPort);
await rm(runtimeFile, { force: true });
const token = randomBytes(32).toString('hex');
await writeFile(runtimeFile, JSON.stringify({ pid: process.pid, token, url, startedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
const env = { ...process.env, PENSIEVE_LOCAL_TOKEN: token, VITE_LOCAL_TOKEN: token,
  VITE_LOCAL_MODE: 'true', VITE_API_BASE_URL: '/api', BACKEND_URL: `http://127.0.0.1:${backendPort}`,
  PENSIEVE_BACKEND_PORT: String(backendPort),
  PENSIEVE_DATA_DIR: resolve(process.env.PENSIEVE_DATA_DIR || resolve(root, '.pensieve/memories')) };
const children = [
  spawn(process.execPath, [resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'backend/src/localIndex.ts'], { cwd: root, env, stdio: 'inherit' }),
  spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], { cwd: resolve(root, 'frontend'), env, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  children.forEach(child => { if (child.exitCode === null) child.kill('SIGTERM'); });
}
children.forEach(child => { child.on('exit', code => stop(code ?? 0)); child.on('error', error => { console.error(error.message); stop(1); }); });
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.once('beforeExit', async () => {
  const owner = await readRuntime();
  if (owner?.pid === process.pid) await rm(runtimeFile, { force: true });
});
console.log(`Pensieve local: ${url} — local storage; cloud AI requires opt-in`);
