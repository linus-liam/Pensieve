import { readRuntime, alive, ready, runtimeFile } from './local-runtime.mjs';
const record = await readRuntime();
if (!record || !alive(record.pid)) console.log('Pensieve 已停止。');
else if (!await ready(record)) {
  console.error(`无法确认进程身份，未自动终止。请检查本地运行记录：${runtimeFile}`);
  process.exitCode = 1;
} else {
  process.kill(record.pid, 'SIGTERM');
  for (let i = 0; i < 100 && alive(record.pid); i++) await new Promise(done => setTimeout(done, 100));
  if (alive(record.pid)) { console.error('仍在等待保存完成；未强制终止进程。'); process.exitCode = 1; }
  else console.log('Pensieve 已停止，已保存的内容仍在本机。');
}
