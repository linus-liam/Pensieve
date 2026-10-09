export const labVersion = import.meta.env.VITE_LAB_VERSION?.trim() || "dev";
export const labBuiltAt = import.meta.env.VITE_LAB_BUILT_AT?.trim() || "";
export const labUpdateReadyEvent = "pensieve:lab-update-ready";

function announceUpdate() {
  window.dispatchEvent(new Event(labUpdateReadyEvent));
}

export async function registerLabServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.register("/sw.js");
  const watch = (worker: ServiceWorker | null) => {
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) announceUpdate();
    });
  };

  if (registration.waiting && navigator.serviceWorker.controller) announceUpdate();
  registration.addEventListener("updatefound", () => watch(registration.installing));

  const check = () => { void registration.update().catch(() => {}); };
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
}

export async function checkForLabUpdate() {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  await registration.update();
  return true;
}
