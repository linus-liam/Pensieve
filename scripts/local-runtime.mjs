import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const runtime = resolve(process.env.PENSIEVE_RUNTIME_DIR || resolve(root, '.pensieve/runtime'));
export const runtimeFile = resolve(runtime, 'server.json');
export const frontendPort = port(process.env.PENSIEVE_FRONTEND_PORT, 5175);
export const backendPort = port(process.env.PENSIEVE_BACKEND_PORT, 3002);
export const url = `http://127.0.0.1:${frontendPort}`;
function port(value, fallback) {
  const n = Number(value || fallback);
  if (!Number.isInteger(n) || n < 1024 || n > 65535) throw new Error('本地端口必须是 1024–65535 的整数');
  return n;
}
export async function prepareRuntime() { await mkdir(runtime, { recursive: true, mode: 0o700 }); }
export async function readRuntime() {
  try {
    const record = JSON.parse(await readFile(runtimeFile, 'utf8'));
    if (Number.isInteger(record.pid) && record.pid > 0 && /^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(record.url) && /^[0-9a-f]{64}$/.test(record.token)) return record;
  } catch { /* Absent or incomplete metadata is not a running instance. */ }
  return null;
}
export function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; } // A permission boundary is not evidence that a process exited.
}
export async function ready(record) {
  if (!record || !alive(record.pid)) return false;
  try {
    const response = await fetch(`${record.url}/api/local-info`, { headers: { 'X-Pensieve-Local-Token': record.token }, signal: AbortSignal.timeout(1000), redirect: 'error' });
    if (!response.ok) return false;
    return (await response.json()).mode === 'local';
  } catch { return false; }
}
export async function requireFreePort(number) {
  await new Promise((ok, fail) => {
    const server = createServer();
    server.once('error', () => fail(new Error(`端口 ${number} 已被占用，请先关闭已有的 Pensieve 服务；不会自动终止其他程序。`)));
    server.listen(number, '127.0.0.1', () => server.close(ok));
  });
}
