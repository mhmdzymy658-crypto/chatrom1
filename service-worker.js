/* Pro Chat — Service Worker (GitHub Pages: /chatrom1/)
   اصل مهم: فقط درخواست‌های GET هم‌مبدأ (خود GitHub Pages) را مدیریت می‌کند.
   Supabase، WebSocket (realtime)، CDNها و فونت‌ها اصلاً دستکاری نمی‌شوند. */
const BASE = '/chatrom1/';
const CACHE = 'prochat-pwa-v1';
const PRECACHE = [BASE, BASE + 'index.html', BASE + 'offline.html', BASE + 'manifest.json', BASE + 'icon-192.png', BASE + 'icon-512.png'];
const NEVER_CACHE = ['version.json', 'sw.js', 'service-worker.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // POST/PUT و ... دست‌نخورده
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase / CDN / فونت: مستقیم به شبکه
  if (!url.pathname.startsWith(BASE)) return;
  if (NEVER_CACHE.some(n => url.pathname.endsWith('/' + n))) return; // چک آپدیت همیشه از شبکه
  if (req.headers.get('range')) return;

  // صفحه‌ی اصلی: اول شبکه (همیشه آخرین نسخه)، اگر آفلاین بود نسخه‌ی کش‌شده
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(BASE, copy)); }
        return res;
      }).catch(async () =>
        (await caches.match(BASE)) || (await caches.match(BASE + 'index.html')) || (await caches.match(BASE + 'offline.html')) || Response.error()
      )
    );
    return;
  }

  // آیکون و تصویر: اول کش، در پس‌زمینه تازه‌سازی
  if (/\.(png|jpe?g|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // بقیه‌ی فایل‌های هم‌مبدأ: اول شبکه، بعد کش
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req))
  );
});
