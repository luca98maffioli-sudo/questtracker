const CACHE_NAME = 'questtracker-v1';
const ASSETS = [
    'gandalf.html',
    'manifest.json',
    'css/style.css',
    'js/app.js',
    'js/supabase.js',
    'js/game-engine.js',
    'js/gps-tracker.js',
    'js/bridge-engine.js',
    'js/fantasy-map.js',
    'js/combat-engine.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                if (event.request.url.startsWith('http') && !event.request.url.includes('supabase')) {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                }
                return response;
            });
        })
    );
});
