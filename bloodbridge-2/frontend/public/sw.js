// Minimal service worker — present so the ambulance PWA is installable
// (per SPEC.md section 2/7: "PWA-installable for ambulance use").
// Deliberately a passthrough with no caching: this is a live coordination
// tool, so serving stale cached data would be worse than no offline support.
// A real offline strategy (e.g. cache the app shell, queue writes while
// offline) is a reasonable Phase 2 addition once the backend is on a real
// deployment.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Intentionally no-op: let the browser handle every request normally.
});
