import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import "./styles.css";
import { mobileMode } from "./local";
import { registerLabServiceWorker } from "./mobile/lab";

if (mobileMode && import.meta.env.PROD && "serviceWorker" in navigator) {
  void registerLabServiceWorker().catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
