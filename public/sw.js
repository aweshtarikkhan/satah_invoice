// Satah Invoices service worker — minimal app-shell + offline fallback.
// Network-first for navigation and JavaScript so Vite/React chunks never go stale.
const CACHE = "satah-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache Supabase / API calls
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r || new Response("Offline", { status: 503 })))
    );
    return;
  }

  if (req.destination === "script" || url.pathname.startsWith("/node_modules/.vite/") || url.pathname.startsWith("/src/")) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => new Response("", { status: 504 })));
    return;
  }

  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (req.destination === "style" || req.destination === "image" || req.destination === "font")) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then((cached) => cached || new Response("", { status: 504 })))
  );
});
