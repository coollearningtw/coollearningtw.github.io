// sw.js - Service Worker
const CACHE_NAME = 'cool-learning-offline-v1';
const OFFLINE_URL = 'offline.html';

// 1. 安裝階段：預先快取離線頁面
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        })
    );
    // 立即接管頁面
    self.skipWaiting();
});

// 2. 激活階段：清理舊快取
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// 3. 攔截請求：如果網路失敗，回傳離線頁面
self.addEventListener('fetch', (event) => {
    // 只攔截頁面導航請求 (Navigate)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // 當 fetch 失敗 (斷線) 時，開啟快取回傳 offline.html
                return caches.open(CACHE_NAME).then((cache) => {
                    return cache.match(OFFLINE_URL);
                });
            })
        );
    }
});