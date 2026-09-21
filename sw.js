/* Service worker : réseau d'abord, cache en secours, pour les fichiers de l'app uniquement (jamais l'API). */
const CACHE = "treso-v1";
const SHELL = ["app.html", "index.html", "assets/ui.css", "assets/ui.js", "assets/app.js", "assets/flux.js", "assets/pages/jour.js", "assets/pages/previsionnel.js", "assets/pages/tiers.js", "assets/pages/plus.js", "assets/pages/login.js", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => null)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== "GET" || url.pathname.endsWith("link.json")) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => null); return r; }).catch(() => caches.match(e.request)));
});
