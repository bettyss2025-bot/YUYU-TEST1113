const BASE=new URL('./',self.location.href);
const CACHE='roam-app-v4-'+BASE.pathname;
const SHELL=['/explore-data.js','/explore-ui.js','/explore.css','/assets/place-placeholder.svg','/assets/explore/sunset-platform.jpg','/assets/explore/dadaocheng.jpg','/assets/explore/calligraphy.jpg','/assets/explore/pier2.jpg','/assets/explore/qixingtan.jpg','/','/index.html','/app.js','/data.js','/finance.js','/services.js','/itinerary.js','/demo-itinerary.js','/style.css','/itinerary.css','/itinerary-enrichment.css','/mobile-app.css','/pwa.js','/manifest.webmanifest','/assets/tainan-shennong.jpg','/assets/app-icon.svg','/assets/app-icon-192.png','/assets/app-icon-512.png','/assets/app-icon-maskable.png','/assets/apple-touch-icon.png'].map(path=>new URL('.'+path,BASE).pathname);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('roam-app-v4-'+BASE.pathname)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 // Keep HTML and ES modules from the same release. All shell assets are installed atomically.
 if(SHELL.includes(url.pathname))event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));
});

