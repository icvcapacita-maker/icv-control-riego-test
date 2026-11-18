/* Control de Riego v0.4 - Offline app shell. Nunca cachea teselas OSM,
 * respuestas de Apps Script, solicitudes POST ni datos de operadores. */
'use strict';
const VERSION = 'icv-riego-shell-v0.4.2';
const PREFIX = 'icv-riego-shell-';
const SHELL = [
  './', './index.html', './supervision.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
const SHELL_URLS = new Set(SHELL.map(x => new URL(x, self.registration.scope).pathname));
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== VERSION).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // No interceptar nunca Apps Script ni las teselas OSM ni otros proveedores.
  if (url.origin !== self.location.origin) return;
  if (!SHELL_URLS.has(url.pathname)) return;
  // HTML: prioriza la version publicada; si no hay red, sirve la copia offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(response => {
      if (response.ok) {
        const c = response.clone();
        event.waitUntil(caches.open(VERSION).then(cache => cache.put(req, c)));
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(VERSION);
      return (await cache.match(req, {ignoreSearch:true})) ||
        (await cache.match('./index.html')) || Response.error();
    }));
    return;
  }
  // Shell y recursos locales: respuesta cacheada, revalida en el fondo.
  event.respondWith(caches.open(VERSION).then(async cache => {
    const saved = await cache.match(req, {ignoreSearch:true});
    const network = fetch(req).then(response => {
      if (response.ok) event.waitUntil(cache.put(req, response.clone()));
      return response;
    }).catch(() => null);
    return saved || await network || Response.error();
  }));
});
