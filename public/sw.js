const CACHE = 'neuro-tracker-v5';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./icon.svg','./src/main.js','./src/style.css','./src/data.js','./src/cycle.js','./src/db.js','./src/config.js','./src/crypto.js','./src/backup.js','./src/drive.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url=new URL(event.request.url);
  if(url.origin.includes('googleapis.com')||url.origin.includes('accounts.google.com')) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy=response.clone(); caches.open(CACHE).then(c=>c.put(event.request,copy)); return response;
  }).catch(()=>caches.match('./index.html'))));
});
