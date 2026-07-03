/* BRIDGE service worker. Minimal by design at G0: installability now, push at G4. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* A fetch handler must exist for installability. Network passthrough; no caching of app data. */
self.addEventListener("fetch", () => {});
