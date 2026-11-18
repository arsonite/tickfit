// Network first with the cache as fallback: the app opens offline, and an online start never shows an old build
const CACHE = 'tickfit-shell';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    // The data is never served from the cache, an old week would look like the real one
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/hsdb/')) {
        return;
    }
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request).then((hit) => hit ?? caches.match(self.registration.scope))),
    );
});
