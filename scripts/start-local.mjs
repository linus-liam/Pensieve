import { spawn } from 'node:child_process';
import { open, mkdir, rm, readFile, writeFile, stat, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, runtime, url, readRuntime, ready, prepareRuntime, alive } from './local-runtime.mjs';
const sleep = ms => new Promise(done => setTimeout(done, ms));
const lock = resolve(runtime, 'start.lock');
let ownedLock = false;
async function launch() {
  await prepareRuntime();
  const running = await readRuntime();
  if (await ready(running)) {
    if (running.url !== url) throw new Error(`Pensieve 已在 ${running.url} 运行。更换端口前请先运行 npm run stop:local。`);
    return;
  }
  try {
    await mkdir(lock, { mode: 0o700 }); ownedLock = true;
    await writeFile(resolve(lock, 'pid'), String(process.pid), { mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // A second click waits for the first launcher; it never starts another writer.
    for (let i = 0; i < 40; i++) {
      if (await ready(await readRuntime())) return;
      const owner = Number(await readFile(resolve(lock, 'pid'), 'utf8').catch(() => '0'));
      if (owner > 0 && !alive(owner)) {
        await rm(lock, { recursive: true, force: true });
        return launch();
      }
      await sleep(300);
    }
    throw new Error('另一次启动尚未完成，请稍后再试。');
  }
  const existing = await readRuntime();
  if (existing && alive(existing.pid)) {
    for (let i = 0; i < 20; i++) { if (await ready(existing)) return; await sleep(300); }
    throw new Error('本地进程在运行，但服务尚未就绪。请先运行 npm run stop:local，再重新打开。');
  }
  const logPath = resolve(runtime, 'server.log');
  if ((await stat(logPath).catch(() => null))?.size > 2 * 1024 * 1024) await rename(logPath, resolve(runtime, 'server.previous.log'));
  const log = await open(logPath, 'a', 0o600);
  const child = spawn(process.execPath, [resolve(root, 'scripts/local.mjs')], { cwd: root, env: process.env, detached: true, stdio: ['ignore', log.fd, log.fd] });
  child.unref();
  await log.close();
  let spawnError;
  child.on('error', error => { spawnError = error; });
  for (let i = 0; i < 60; i++) {
    if (await ready(await readRuntime())) return;
    if (spawnError || child.exitCode !== null) throw new Error(`启动失败。运行日志：${logPath}`);
    await sleep(300);
  }
  child.kill('SIGTERM');
  throw new Error(`启动超时。运行日志：${logPath}`);
}
try {
  await launch();
  console.log(`Pensieve 已就绪：${url}`);
  if (process.env.PENSIEVE_NO_OPEN !== '1' && process.platform === 'darwin') {
    const browser = spawn('open', [url], { stdio: 'ignore' });
    browser.on('error', () => console.error(`请在浏览器打开 ${url}`));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { if (ownedLock) await rm(lock, { recursive: true, force: true }); }
