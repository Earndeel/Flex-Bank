const CACHE = 'flex-v11';
const FILES = ['./reference-icons.js?v=1','./i18n.js?v=1','./icon.svg?v=9','./ui-metrics.js?v=2','./promo-travel.svg?v=1','./promo-card.svg?v=1','./promo-assets.svg?v=1','./design.css?v=11','./scenario.js?v=3','./editor.css?v=1','./expenses.js?v=4','./expenses.css?v=1','./','./index.html','./styles.css?v=9','./core.js?v=9','./app.js?v=11','./startup.js?v=10','./icon-192.png?v=9','./icon-512.png?v=9','./apple-touch-icon.png?v=9','./manifest.webmanifest?v=9'];
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
