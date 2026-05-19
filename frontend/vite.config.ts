import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // In Docker the backend is reachable by service name; override via env.
      "/api": process.env.BACKEND_URL ?? "http://localhost:3001",
    },
  },
});
