// Офлайн-режим: приложение сохраняет свои файлы в телефоне и открывается без интернета.
//
// Свои файлы — «сначала сеть»: если интернет есть, берём свежую версию (и обновляем копию),
// если сети нет или она тормозит больше 3 секунд — открываем сохранённую копию.
// Шрифты Google — «сначала копия»: они не меняются.

const CACHE = "workout-v3";
const FILES = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/app.js", "js/exercises.js", "js/plan.js", "js/store.js", "js/workout.js", "js/progress.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(request) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match(request, { ignoreSearch: true })
      .then((hit) => hit || (request.mode === "navigate" ? caches.match("index.html") : null))
      .then((hit) => hit || Response.error());
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fallback()); } }, 3000);
    fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fallback()); } });
  });
}

function cacheFirst(request) {
  return caches.match(request).then((hit) => hit || fetch(request).then((res) => {
    if (res.ok || res.type === "opaque") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  }));
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) e.respondWith(networkFirst(e.request));
  else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(cacheFirst(e.request));
});
