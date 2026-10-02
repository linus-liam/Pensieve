import "./config/env.js";
import { resolve } from "node:path";
import { createLocalApp } from "./localApp.js";
import { LocalBackups } from "./services/localBackups.js";
const directory = process.env.PENSIEVE_DATA_DIR;
const token = process.env.PENSIEVE_LOCAL_TOKEN;
if (!directory || !token) throw new Error("Use npm run local to start the local app");
const backups = new LocalBackups(resolve(directory));
void backups.run().catch(() => console.error("本地自动备份未完成，请在设置中查看。"));
const server = createLocalApp(resolve(directory), token, undefined, backups).listen(Number(process.env.PENSIEVE_BACKEND_PORT || 3002), "127.0.0.1", () => {
  console.log(`Local memories: ${resolve(directory)}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => { void backups.close().catch(() => {}).finally(() => process.exit(0)); }));
}
