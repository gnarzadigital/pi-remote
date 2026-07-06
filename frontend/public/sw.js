// pi-remote service worker — NETWORK-ONLY (no asset caching).
//
// This is a LAN/tailnet dev tool that is always online when in use. The prior
// caching service worker repeatedly served STALE or BROKEN builds to the iOS
// standalone PWA (Add-to-Home-Screen), because iOS pins a web clip's service
// worker hard and the cached index.html could reference asset hashes that a
// later build had deleted -> blank screen / old UI. Removing the fetch handler
// means every request goes straight to the network, so the app is ALWAYS the
// current build. Push notifications still work (handler below).
const CACHE_NAME = "pi-remote-v20";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  // Purge EVERY cache left by older caching service workers so no stale build
  // can ever be served again, then take control of open clients immediately.
  evt.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Intentionally NO "fetch" listener: unhandled fetches go to the network by
// default, guaranteeing the latest build every load.

self.addEventListener("push", (evt) => {
  let data = { title: "pi", body: "LLM finished working." };
  try {
    if (evt.data) data = { ...data, ...evt.data.json() };
  } catch {}
  evt.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: "pi-remote-agent-finished",
      renotify: true,
    })
  );
});
