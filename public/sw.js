// Temporary cleanup worker: removes the old app-shell service worker that was
// causing stale route loads/reloads. Keep manifest install metadata separate.
function isSatahAppCache(name) {
  return name === "satah-v1" || name === "satah-v2" || name.startsWith("satah-");
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.filter(isSatahAppCache).map((name) => caches.delete(name)));
        await self.clients.claim();
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
