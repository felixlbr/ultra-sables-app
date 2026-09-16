// Service worker Ultra Sables (SPEC § 4.6). VERSION réécrite par projet/outils/version.py.
const VERSION = "v20260916-2235";
const CACHE = "us-" + VERSION;

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/main.js",
  "js/version.js",
  "js/sim.js",
  "js/stockage.js",
  "js/position.js",
  "js/reseau.js",
  "js/partage.js",
  "js/contexte.js",
  "js/vues/commun.js",
  "js/vues/etats.js",
  "js/vues/trace.js",
  "js/vues/pause.js",
  "js/vues/recherche.js",
  "js/vues/gares.js",
  "js/logique/temps.js",
  "js/logique/format.js",
  "js/logique/geo.js",
  "js/logique/plan.js",
  "js/logique/ouverture.js",
  "js/logique/soleil.js",
  "js/logique/vent.js",
  "js/logique/meteo.js",
  "js/logique/recherche.js",
  "js/logique/gares.js",
  "js/logique/gpx.js",
  "fonts/Luciole-Regular.woff2",
  "fonts/Luciole-Bold.woff2",
  "fonts/LICENCE-Luciole.txt",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "data/course.json",
  "data/trace.json",
  "data/pauses.json",
  "data/poi.json",
  "data/gares.json",
  "gpx/sables-talmont.gpx",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c.startsWith("us-") && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // autres origines : non interceptées

  if (req.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE)
        .then((cache) => cache.match("index.html", { ignoreSearch: true }))
        .then((rep) => rep || fetch(req)),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((trouve) => {
        if (trouve) return trouve;
        return fetch(req).then((rep) => {
          if (rep && rep.status === 200 && rep.type === "basic") cache.put(req, rep.clone());
          return rep;
        });
      }),
    ),
  );
});
