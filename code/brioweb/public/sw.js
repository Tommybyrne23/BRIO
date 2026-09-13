const CACHE = "brio-public-v1";
const PUBLIC_FALLBACK = ["/demo", "/offline", "/brio-icon.svg", "/brio-lockup.svg", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_FALLBACK)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/training") || url.pathname.startsWith("/nutrition") || url.pathname.startsWith("/recovery") || url.pathname.startsWith("/data") || url.pathname.startsWith("/profile") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/onboarding")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname.startsWith("/demo") ? "/demo" : "/offline")));
    return;
  }
  if (PUBLIC_FALLBACK.includes(url.pathname)) event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
