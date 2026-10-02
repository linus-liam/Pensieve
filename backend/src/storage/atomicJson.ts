import { randomUUID } from "node:crypto";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

export async function atomicJson(path: string, value: unknown) {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(value, null, 2) + "\n"); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, path);
    const folder = await open(directory, "r");
    try { await folder.sync(); } finally { await folder.close(); }
  } finally { await unlink(temporary).catch(() => {}); }
}
