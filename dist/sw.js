const CACHE = 'flex-v23';
const FILES = ["./","./index.html","./icon-512.png?v=11","./apple-touch-icon.png?v=11","./manifest.webmanifest?v=11","./styles.css?v=17","./expenses.css?v=1","./editor.css?v=4","./design.css?v=21","./startup.js?v=20","./app.js?v=23","./reference-icons.js?v=2","./i18n.js?v=5","./core.js?v=11","./expenses.js?v=4","./scenario.js?v=5","./expense-editor.js?v=2","./ui-metrics.js?v=2","./setup.js?v=4","./icon-192.png?v=11","./promo-travel.svg?v=1","./promo-card.svg?v=1","./promo-assets.svg?v=1"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
  event.respondWith(fetch(event.request).then(response=>{
    if (response.ok && (response.type==='basic'||response.type==='default')) {
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
    }
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached || (event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
