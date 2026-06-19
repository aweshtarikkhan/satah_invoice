import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { cleanupStaleServiceWorkers, setupWebAppManifest } from "./lib/service-worker-cleanup";

cleanupStaleServiceWorkers();
setupWebAppManifest();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <App />
    </ThemeProvider>
  </HelmetProvider>
);
