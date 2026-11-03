/* MUSD Pocket — app-shell service worker. Caches static assets only; never caches RPC/chain data. */
const CACHE = "musd-pocket-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg", "/favicon-32.png", "/apple-touch-icon.png", "/icon-512.png", "/og.jpg", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache chain RPC, explorers, WalletConnect, or API/og (fresh data).
  if (
    url.hostname.includes("mezo.org") ||
    url.hostname.includes("walletconnect") ||
    url.hostname.includes("reown") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }
  // Network-first for navigations so deploys show up; cache fallback offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match(req)))
    );
    return;
  }
  // Cache-first for same-origin static assets (JS/CSS/fonts/images under /assets).
  if (url.origin === self.location.origin && (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname))) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});
