// ════════════════════════════════════════════
//  璀璨 花卉圖鑑 — Service Worker
//  快取策略：
//  - 靜態資源（HTML/CSS/JS）→ Cache First（優先用快取）
//  - Google Sheets API     → Network First（優先用網路，失敗才用快取）
// ════════════════════════════════════════════

const CACHE_NAME = 'cuican-v21';
const STATIC_ASSETS = [
  '/index.html',
  '/home.html',
  '/guide.html',
  '/editor.html',
  '/member-editor.html',
  '/flower-showcase.html',
  '/flower-showcase.js',
  '/header.js',
  '/config.js',
  '/style.css',
  '/manifest.json',
  '/icon.jpg',
];

// ── 安裝：預先快取靜態資源 ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── 啟動：清除舊版快取 ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── 攔截請求 ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Sheets API → Network First
  if (url.hostname === 'sheets.googleapis.com') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 跨域資源（圖片等）→ 直接網路，不快取
  if (url.origin !== self.location.origin) {
    return;
  }

  // 靜態資源 → index.html / editor / member-editor 用 Network First，其他用 Cache First
  if (url.pathname === '/index.html' || url.pathname === '/' ||
      url.pathname.includes('editor.html') || url.pathname.includes('contest') ||
      url.pathname.includes('guide') || url.pathname.includes('wars')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

// Cache First：先找快取，沒有才去網路並存入快取
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('離線中，無法載入資源', { status: 503 });
  }
}

// Network First：先去網路，失敗才用快取
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: '離線中，無法取得最新資料' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
