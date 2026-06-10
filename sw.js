// Elvi service worker — network first.
// Hae aina ensin verkosta (sovellus päivittyy automaattisesti);
// käytä välimuistia vain jos verkko ei vastaa (offline).

const CACHE = 'elvi-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Oman sovelluskoodin (sama alkuperä) haetaan ohittaen selaimen HTTP-välimuisti,
  // jotta uusi versio näkyy heti — muuten GitHub Pagesin ~10 min välimuisti voi
  // palauttaa vanhan index.html:n vaikka service worker hakee "verkko ensin".
  let req = e.request;
  try {
    if (new URL(e.request.url).origin === self.location.origin) {
      req = new Request(e.request, { cache: 'no-store' });
    }
  } catch (err) { /* käytä alkuperäistä pyyntöä */ }
  e.respondWith(
    fetch(req)
      .then((resp) => {
        // Tallenna tuore vastaus välimuistiin offline-varalle
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
