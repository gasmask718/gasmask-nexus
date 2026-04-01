import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./theme/departmentStyles.css";

// Register service worker globally
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => console.log('[SW] Registered'))
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);

