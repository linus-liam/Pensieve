import { resolve } from "node:path";
import { restoreLocalBackup } from "./services/localBackups.js";
const [snapshot, destination] = process.argv.slice(2);
if (!snapshot || !destination) {
  console.error("用法：npm run restore:local -- <快照目录> <尚不存在的恢复目录>");
  process.exitCode = 1;
} else {
  try { console.log(`已恢复 ${await restoreLocalBackup(resolve(snapshot), resolve(destination))} 个文件到 ${resolve(destination)}`); }
  catch (error) { console.error(error instanceof Error ? error.message : "恢复失败"); process.exitCode = 1; }
}
