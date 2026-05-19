import "dotenv/config";
import { createApp } from "./app.js";
import { pool } from "./db/client.js";

const PORT = process.env.PORT ?? 3001;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Pensieve backend running on http://localhost:${PORT}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
