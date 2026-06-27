import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../");
const repoRoot = resolve(backendRoot, "..");

const envFiles = [
  resolve(repoRoot, ".env"),
  resolve(repoRoot, ".env.local"),
  resolve(backendRoot, ".env"),
  resolve(backendRoot, ".env.local"),
];

for (const path of envFiles) {
  if (existsSync(path)) {
    dotenv.config({ path, override: false });
  }
}

export function getEnvValue(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (!value) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      const unquoted = value.slice(1, -1).trim();
      if (unquoted) return unquoted;
      continue;
    }

    return value;
  }

  return undefined;
}
