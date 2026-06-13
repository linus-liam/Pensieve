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
