import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme/departmentStyles.css";

async function clearDevServiceWorkers() {
  if (!import.meta.env.DEV || !("serviceWorker" in navigator)) {
    return true;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) {
    return true;
  }

  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await window.caches.keys();
    await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
  }

  window.location.reload();
  return false;
}

async function bootstrap() {
  const shouldContinue = await clearDevServiceWorkers();
  if (!shouldContinue) return;

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => console.log("[SW] Registered"))
        .catch((err) => console.warn("[SW] Registration failed:", err));
    });
  }

  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();

