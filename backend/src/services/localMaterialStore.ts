import { randomUUID } from "node:crypto";
import { mkdir, open, link, unlink, readFile, readdir, lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AppError } from "../errors.js";
import { fail, makeMaterial, readMaterialBackup, summary, verifyMaterial, type RawMaterial } from "../imports/materials.js";
import { readMaterial } from "../imports/readMaterial.js";

export class LocalMaterialStore {
  constructor(readonly directory: string) {}
  async get(id: string): Promise<RawMaterial> {
    if (!/^[0-9a-f]{64}$/.test(id)) throw new AppError(400, "原材料编号无效", "invalid_id");
    const path = join(this.directory, `${id}.json`);
    try {
      if (!(await lstat(path)).isFile()) fail("原件类型无效。");
      const record = await verifyMaterial(JSON.parse(await readFile(path, "utf8")));
      if (record.id !== id) fail("原件编号与文件不一致。");
      return record;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new AppError(404, "原材料不存在", "not_found");
      throw e;
    }
  }
  async list() {
    const entries = await readdir(this.directory, { withFileTypes: true }).catch((e: NodeJS.ErrnoException) => { if (e.code === "ENOENT") return []; throw e; });
    const records = [];
    for (const entry of entries) if (entry.isFile() && /^[0-9a-f]{64}\.json$/.test(entry.name)) records.push(summary(await this.get(entry.name.slice(0, -5))));
    return records.sort((a, b) => b.imported_at.localeCompare(a.imported_at));
  }
  async import(value: unknown) { return this.save(await makeMaterial(value)); }
  async restore(value: unknown) { return this.save(await readMaterialBackup(value)); }
  private async save(record: RawMaterial) {
    // Finish validation before making the source visible. One file contains bytes and provenance.
    await readMaterial(record);
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = join(this.directory, `.pending-${randomUUID()}`);
    const destination = join(this.directory, `${record.id}.json`);
    let duplicate = false;
    try {
      const handle = await open(temporary, "wx", 0o600);
      try { await handle.writeFile(JSON.stringify(record) + "\n"); await handle.sync(); }
      finally { await handle.close(); }
      // An atomic, no-replace publish also protects retries from a second process.
      try { await link(temporary, destination); }
      catch (e) { if ((e as NodeJS.ErrnoException).code === "EEXIST") duplicate = true; else throw e; }
      const folder = await open(this.directory, "r");
      try { await folder.sync(); } finally { await folder.close(); }
      const parent = await open(dirname(this.directory), "r");
      try { await parent.sync(); } finally { await parent.close(); }
      const saved = await this.get(record.id);
      return { material: summary(saved), duplicate };
    } finally { await unlink(temporary).catch(() => {}); }
  }
}
