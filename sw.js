const CACHE='time-garden-v1';
const FILES=['./time-budget-tracker.html','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
