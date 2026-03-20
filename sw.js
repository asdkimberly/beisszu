// ══════════════════════════════════════════════════════
// Beiß zu — Service Worker
// Offline support + write queue sync
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'beisszu-v1';
const OFFLINE_QUEUE_KEY = 'bz_offline_queue';

// Assets to cache on install
const PRECACHE = [
  '/',
  '/index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ── Install: precache shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for app shell, network-first for Supabase ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Let Supabase API calls go through normally (don't intercept)
  if (url.hostname.includes('supabase.co')) return;

  // For navigation requests, return cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html') || caches.match('/')
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// ── Message: sync offline queue ──
self.addEventListener('message', event => {
  if (event.data?.type === 'SYNC_QUEUE') {
    // Signal to clients that SW is ready to sync
    self.clients.matchAll().then(clients =>
      clients.forEach(c => c.postMessage({ type: 'SW_READY' }))
    );
  }
});
