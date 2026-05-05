// Service Worker — Controle LT Suzano
// Versão do cache — incremente ao atualizar o app
const CACHE_NAME = 'controle-lt-v5';

// Recursos para cachear ao instalar
const PRECACHE = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── INSTALAR: cachear recursos estáticos ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(e => console.log('Cache parcial:', e)))
      .then(() => self.skipWaiting())
  );
});

// ── ATIVAR: limpar caches antigos ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-first para estáticos, Network-first para Firebase ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase — sempre tenta rede, sem interceptar
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    return; // deixa passar sem interceptar
  }

  // Google Fonts — cache primeiro
  if (url.hostname.includes('fonts.goog') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Scripts externos (jsPDF, XLSX, etc) — cache primeiro
  if (url.hostname.includes('cdnjs') || url.hostname.includes('jsdelivr') || url.hostname.includes('gstatic')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // App principal (HTML) — Network-first com fallback para cache
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        // Atualizar cache com versão mais recente
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return resp;
      })
      .catch(() => {
        // Offline: usar cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback para index.html
          return caches.match('./index.html');
        });
      })
  );
});

// ── MENSAGENS do app ─────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
