const CACHE_NAME = "pi-remote-v4";
const PRECACHE_ASSETS = ["/", "/index.html", "/manifest.json", "/icon.svg"];
const NETWORK_FIRST_PATHS = new Set(["/", "/index.html", "/manifest.json"]);

self.addEventListener("install", (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (evt) => {
  const url = new URL(evt.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (NETWORK_FIRST_PATHS.has(url.pathname) || url.pathname.startsWith("/assets/")) {
    evt.respondWith(networkFirst(evt.request));
  }
});

self.addEventListener("push", (evt) => {
  let data = { title: "pi remote", body: "LLM finished working." };
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
