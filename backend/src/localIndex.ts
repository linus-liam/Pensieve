import "./config/env.js";
import { resolve } from "node:path";
import { createLocalApp } from "./localApp.js";
const directory = process.env.PENSIEVE_DATA_DIR;
const token = process.env.PENSIEVE_LOCAL_TOKEN;
if (!directory || !token) throw new Error("Use npm run local to start the local app");
const server = createLocalApp(resolve(directory), token).listen(3002, "127.0.0.1", () => {
  console.log(`Local memories: ${resolve(directory)}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
