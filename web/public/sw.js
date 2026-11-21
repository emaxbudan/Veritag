/**
 * Veritag Service Worker — offline-first caching strategy.
 *
 * Cache strategy:
 *  - Static shell (HTML, JS, CSS, fonts, icons): Cache-First with network fallback.
 *  - API /v1/verify/* requests: StaleWhileRevalidate, cached for offline Merkle proof replay.
 *  - Everything else: Network-First with cache fallback.
 */

const CACHE_NAME = "veritag-v1";
const OFFLINE_URL = "/";

/** Assets pre-cached at install time (app shell). */
const PRECACHE_ASSETS = [
  "/",
  "/owner",
  "/brand",
  "/service",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests (and cross-origin scanner libs).
  if (request.method !== "GET") return;

  // Verification API calls: StaleWhileRevalidate so offline users see cached results.
  if (url.pathname.startsWith("/v1/verify") || url.pathname.startsWith("/v/")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Static assets and app shell: Cache-First.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests: Network-First, fallback to cached page or offline shell.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // Everything else: Network-First with cache fallback.
  event.respondWith(networkFirst(request));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

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
    return new Response("Asset unavailable offline.", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached ?? (await fetchPromise) ?? new Response(JSON.stringify({ offline: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

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
    return cached ?? new Response("Unavailable offline.", { status: 503 });
  }
}

async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try the exact URL, then fall back to the offline shell.
    const cached =
      (await caches.match(request)) ?? (await caches.match(OFFLINE_URL));
    return (
      cached ??
      new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/html" },
      })
    );
  }
}
