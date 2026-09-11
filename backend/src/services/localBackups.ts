import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, rename, rm, lstat } from "node:fs/promises";
import { join } from "node:path";

const recordName = /^[0-9a-f-]{36}\.json$/;
const snapshotName = /^snapshot-[0-9T-]+-[0-9a-f-]{36}$/;
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
interface Manifest {
  format: 1; created_at: string; digest: string;
  files: { path: string; sha256: string; bytes: number }[];
}

async function manifests(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const entries = await readdir(directory, { withFileTypes: true });
  const result: { name: string; manifest: Manifest }[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !snapshotName.test(entry.name)) continue;
    try {
      const manifest = JSON.parse(await readFile(join(directory, entry.name, "manifest.json"), "utf8")) as Manifest;
      if (manifest.format === 1 && Number.isFinite(Date.parse(manifest.created_at)) && Array.isArray(manifest.files)) result.push({ name: entry.name, manifest });
    } catch { /* An incomplete or unknown folder is never considered a usable backup. */ }
  }
  return result.sort((a, b) => b.manifest.created_at.localeCompare(a.manifest.created_at));
}

export class LocalBackups {
  readonly directory: string;
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private error: string | null = null;
  constructor(private source: string, directory = join(source, ".backups")) { this.directory = directory; }

  async status() {
    try {
      const snapshots = await manifests(this.directory);
      return { directory: this.directory, lastBackupAt: snapshots[0]?.manifest.created_at ?? null, count: snapshots.length, error: this.error };
    } catch {
      return { directory: this.directory, lastBackupAt: null, count: 0, error: "无法读取备份目录，请检查磁盘空间或目录权限。" };
    }
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = undefined; void this.run().catch(() => {}); }, 1500);
    this.timer.unref();
  }

  run() {
    const task = this.queue.catch(() => {}).then(() => this.snapshot());
    this.queue = task;
    return task.then(async () => { this.error = null; return this.status(); }, error => {
      this.error = "最近一次备份未完成，请检查磁盘空间或目录权限。";
      throw error;
    });
  }

  async close() { clearTimeout(this.timer); await this.run(); }

  private async snapshot() {
    await mkdir(this.source, { recursive: true, mode: 0o700 });
    const paths: string[] = [];
    for (const prefix of ["", "sessions"]) {
      const folder = join(this.source, prefix);
      const entries = await readdir(folder, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
      for (const entry of entries) if (entry.isFile() && recordName.test(entry.name)) paths.push(prefix ? `${prefix}/${entry.name}` : entry.name);
    }
    paths.sort();
    const contents = await Promise.all(paths.map(async path => {
      const bytes = await readFile(join(this.source, path));
      // Stores replace complete JSON files atomically. Do not bless a corrupt file as a valid snapshot.
      JSON.parse(bytes.toString("utf8"));
      return { path, bytes };
    }));
    const files = contents.map(file => ({ path: file.path, sha256: hash(file.bytes), bytes: file.bytes.length }));
    const digest = hash(JSON.stringify(files));
    const existing = await manifests(this.directory);
    if (existing[0]?.manifest.digest === digest) return;
    const created_at = new Date().toISOString();
    const name = `snapshot-${created_at.replace(/[:.Z]/g, "-")}-${randomUUID()}`;
    const temporary = join(this.directory, `.pending-${randomUUID()}`);
    const manifest: Manifest = { format: 1, created_at, digest, files };
    try {
      await mkdir(temporary, { mode: 0o700 });
      for (const file of contents) {
        if (file.path.startsWith("sessions/")) await mkdir(join(temporary, "sessions"), { recursive: true, mode: 0o700 });
        await writeFile(join(temporary, file.path), file.bytes, { mode: 0o600, flush: true });
      }
      await writeFile(join(temporary, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600, flush: true });
      await rename(temporary, join(this.directory, name));
    } finally { await rm(temporary, { recursive: true, force: true }); }

    // Keep the latest 20 snapshots plus one per day for the latest 30 days with backups.
    const snapshots = await manifests(this.directory);
    const days = new Set<string>();
    for (const [index, snapshot] of snapshots.entries()) {
      const day = snapshot.manifest.created_at.slice(0, 10);
      const keepDay = !days.has(day) && days.size < 30;
      if (keepDay) days.add(day);
      if (index >= 20 && !keepDay) await rm(join(this.directory, snapshot.name), { recursive: true });
    }
  }
}

export async function restoreLocalBackup(snapshot: string, destination: string) {
  const manifest = JSON.parse(await readFile(join(snapshot, "manifest.json"), "utf8")) as Manifest;
  if (manifest.format !== 1 || !Array.isArray(manifest.files) || hash(JSON.stringify(manifest.files)) !== manifest.digest) throw new Error("备份清单校验失败");
  const contents: { path: string; bytes: Buffer }[] = [];
  const names = new Set<string>();
  for (const file of manifest.files) {
    if (!/^(sessions\/)?[0-9a-f-]{36}\.json$/.test(file.path) || names.has(file.path)) throw new Error("备份文件路径无效");
    names.add(file.path);
    if (file.path.startsWith("sessions/") && (await lstat(join(snapshot, "sessions"))).isSymbolicLink()) throw new Error("备份目录不能是符号链接");
    if (!(await lstat(join(snapshot, file.path))).isFile()) throw new Error("备份文件类型无效");
    const bytes = await readFile(join(snapshot, file.path));
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256) throw new Error("备份文件校验失败");
    JSON.parse(bytes.toString("utf8"));
    contents.push({ path: file.path, bytes });
  }
  // A new directory is required: restoring never overwrites live memories.
  await mkdir(destination, { mode: 0o700 });
  for (const file of contents) {
    if (file.path.startsWith("sessions/")) await mkdir(join(destination, "sessions"), { recursive: true, mode: 0o700 });
    await writeFile(join(destination, file.path), file.bytes, { flag: "wx", mode: 0o600, flush: true });
  }
  return contents.length;
}
