import { atomicJson } from "../storage/atomicJson.js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { AppError } from "../errors.js";
import type { MemoryEntry } from "../types.js";

export interface Revision extends MemoryEntry {
  action: "created" | "edited" | "archived" | "restored";
  revision: number;
  archived: boolean;
}
interface RecordFile { format: 1; revisions: Revision[] }

// Each atomic record contains the complete history. No AI or database dependency.
export class LocalMemoryStore {
  private writes: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}

  private file(id: string) { return join(this.directory, `${id}.json`); }
  private async read(id: string): Promise<RecordFile> {
    try {
      const record = JSON.parse(await readFile(this.file(id), "utf8")) as RecordFile;
      if (record.format !== 1 || !Array.isArray(record.revisions) || !record.revisions.length ||
          record.revisions.some((r) => r.id !== id || typeof r.raw_input !== "string")) {
        throw new Error(`Invalid local memory record: ${id}`);
      }
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new AppError(404, "Memory not found", "not_found");
      throw error;
    }
  }
  private async write(id: string, record: RecordFile) {
    await atomicJson(this.file(id), record);
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writes.then(operation);
    this.writes = result.catch(() => {});
    return result;
  }
  async list(archived = false): Promise<Revision[]> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const names = (await readdir(this.directory)).filter((name) => /^[0-9a-f-]{36}\.json$/.test(name));
    const records = await Promise.all(names.map((name) => this.read(name.slice(0, -5))));
    return records.map((r) => r.revisions.at(-1)!).filter((r) => r.archived === archived)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  }
  async get(id: string) { return (await this.read(id)).revisions.at(-1)!; }
  async history(id: string) { return (await this.read(id)).revisions; }
  create(rawInput: string) {
    return this.serialize(async () => {
      const now = new Date().toISOString();
      const entry: Revision = { id: randomUUID(), user_id: "local", raw_input: rawInput,
        ai_summary: rawInput.slice(0, 160), created_at: now, updated_at: now,
        action: "created", revision: 1, archived: false };
      await this.write(entry.id, { format: 1, revisions: [entry] });
      return entry;
    });
  }
  change(id: string, action: "edited" | "archived" | "restored", rawInput?: string) {
    return this.serialize(async () => {
      const record = await this.read(id);
      const previous = record.revisions.at(-1)!;
      const raw = rawInput ?? previous.raw_input;
      const entry: Revision = { ...previous, raw_input: raw, ai_summary: raw.slice(0, 160),
        updated_at: new Date().toISOString(), action, revision: previous.revision + 1,
        archived: action === "archived" ? true : action === "restored" ? false : previous.archived };
      record.revisions.push(entry);
      await this.write(id, record);
      return entry;
    });
  }
  async exportMarkdown() {
    const entries = [...await this.list(), ...await this.list(true)];
    const sections = await Promise.all(entries.map(async (entry) => {
      const history = await this.history(entry.id);
      return `## ${entry.created_at} · ${entry.id}\n\nStatus: ${entry.archived ? "archived" : "active"}\n\n` +
        history.map((r) => `### Revision ${r.revision} · ${r.action} · ${r.updated_at}\n\n${r.raw_input}\n`).join("\n");
    }));
    return `# Pensieve — local memory archive\n\nExported: ${new Date().toISOString()}\n\nIncludes original text and all revisions, including archived memories.\n\n${sections.join("\n---\n\n")}`;
  }
}
