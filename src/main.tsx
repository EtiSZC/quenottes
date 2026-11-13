import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Fonts are bundled (not fetched from Google Fonts) so the app works fully offline.
import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-600.css";
import "@fontsource/fredoka/latin-700.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-600-italic.css";
import "./index.css";

// Ask the browser to keep the history and stickers (no eviction under storage pressure).
navigator.storage?.persist?.().catch(() => {});

const start = () => createRoot(document.getElementById("root")!).render(<App />);

// Dev server, or a test build made with VITE_FAKE_NOW: fakes the date (see src/lib/devClock.ts). The published app and the
// real APK are built without it.
if (import.meta.env.DEV || import.meta.env.VITE_FAKE_NOW) {
  import("./lib/devClock").then(({ installDevClock }) => {
    installDevClock();
    start();
  });
} else {
  start();
}
