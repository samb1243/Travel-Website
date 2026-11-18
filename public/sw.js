// Tripster's service worker: read-only offline access to your trips.
//
// - Pages: network first. Your trip pages, My trips and shared trip pages are
//   saved on this device as you open them (and in the background for your
//   current and upcoming trips), and shown from there when there's no signal.
// - Anything else offline gets the /offline page, which lists what's saved.
// - Build files (/_next/static) and uploaded photos (/img) are kept as they're
//   used; they never change once published.
// - Nothing is ever sent anywhere: this only keeps copies of pages you can
//   already see. Signing out deletes them (see src/lib/offline.ts).
//
// Keep the names below in sync with src/lib/offline.ts (a unit test checks).

const VERSION = "v1";
const STATIC_CACHE = `tripster-static-${VERSION}`;
const PAGES_CACHE = `tripster-pages-${VERSION}`;
const IMAGES_CACHE = `tripster-images-${VERSION}`;
const OFFLINE_URL = "/offline";
const INDEX_URL = "/__offline-index";
const MAX_PAGES = 120;
const MAX_IMAGES = 150;

/** Pages worth keeping for offline use (path only, no query) */
const SAVEABLE = [
  /^\/dashboard$/,
  /^\/trips\/(?!new$)[A-Za-z0-9_-]+(\/(itinerary|checklist|budget|map))?$/,
  /^\/t\/[A-Za-z0-9_-]+$/,
];
const isSaveable = (path) => SAVEABLE.some((re) => re.test(path));

/** App files kept for offline use (the home-screen app needs its manifest and icons) */
const APP_FILES = ["/manifest.webmanifest", "/icon.svg", "/apple-icon.png"];

// The offline page is fetched signed out, so the copy kept of it holds
// nothing personal (it lists saved trips from the index on this device)
async function storeOfflinePage() {
  const res = await fetch(OFFLINE_URL, { cache: "reload", credentials: "omit" });
  if (!res.ok) throw new Error("offline page unavailable");
  await store(await caches.open(PAGES_CACHE), OFFLINE_URL, res);
}

/**
 * Keeps a plain copy of a page: just the HTML and its type, plus a marker the
 * page reads to say "showing a saved copy" (src/components/offline). Next.js
 * pages vary on in-app navigation headers, which would stop the copy matching
 * (and makes Chrome refuse to replace an older copy). The page's script and
 * style files are saved too, so it works even if it was saved in the background.
 */
async function store(cache, key, res) {
  const html = await res.text();
  const copy = new Response(html, {
    status: 200,
    headers: {
      "content-type": res.headers.get("content-type") || "text/html; charset=utf-8",
      "server-timing": `saved-copy;desc="${new Date().toISOString()}"`,
    },
  });
  await cache.delete(key, { ignoreVary: true });
  await cache.put(key, copy);
  await saveAssets(html);
}

/** Saves the build files a page uses (they never change, so each is fetched once) */
async function saveAssets(html) {
  const cache = await caches.open(STATIC_CACHE);
  const urls = [...new Set(html.match(/\/_next\/static\/[A-Za-z0-9_\-./~%@]+\.(?:js|css|woff2)/g) || [])].slice(0, 80);
  await Promise.all(
    urls.map(async (u) => {
      try {
        if (await cache.match(u)) return;
        const res = await fetch(u);
        if (!res.ok) return;
        if (u.endsWith(".css")) {
          // Fonts are referenced from the stylesheets, not the page
          const css = await res.clone().text();
          const fonts = [...new Set(css.match(/\/_next\/static\/media\/[A-Za-z0-9_\-.]+\.woff2/g) || [])];
          await Promise.all(fonts.map(async (f) => (await cache.match(f)) || fetch(f).then((r) => r.ok && cache.put(f, r))));
        }
        await cache.put(u, res);
      } catch {
        // missing a file: the page still shows, just less interactive
      }
    }),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(storeOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("tripster-") && !keep.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
  } else if (url.pathname.startsWith("/img/")) {
    event.respondWith(cacheFirst(req, IMAGES_CACHE, MAX_IMAGES));
  } else if (APP_FILES.includes(url.pathname) || url.pathname.startsWith("/icons/")) {
    event.respondWith(networkFirst(req, STATIC_CACHE));
  } else if (req.mode === "navigate") {
    event.respondWith(page(event, req, url));
  }
  // Everything else (server actions, API, in-app navigation data) goes
  // straight to the network. When that fails offline, Next.js falls back to a
  // full page load, which lands in page() above.
});

/** Small files that can change (manifest, icons): fresh when online, saved copy offline */
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || Response.error();
  }
}

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    await cache.put(req, res.clone());
    if (max) await trim(cache, max);
  }
  return res;
}

/** The page from the network, saved if it's one of yours; the saved copy when offline. */
async function page(event, req, url) {
  const key = url.origin + url.pathname;
  try {
    const res = await fetch(req);
    // Save in the background, so the page still streams in straight away
    if (isSaveable(url.pathname) && isHtmlPage(res)) event.waitUntil(savePage(key, res.clone()));
    return res;
  } catch {
    const cache = await caches.open(PAGES_CACHE);
    return (await cache.match(key, { ignoreVary: true })) || (await cache.match(OFFLINE_URL, { ignoreVary: true })) || Response.error();
  }
}

/** A real page you can see (not a redirect to log in, not an error) */
function isHtmlPage(res) {
  return res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html");
}

async function savePage(key, res, title) {
  const cache = await caches.open(PAGES_CACHE);
  await store(cache, key, res);
  const path = new URL(key).pathname;
  await updateIndex((index) => {
    index.pages[path] = { savedAt: Date.now(), title: title || index.pages[path]?.title || null };
  });
  await trim(cache, MAX_PAGES + 2, [OFFLINE_URL, INDEX_URL]);
}

// The index is read, changed and written back; one change at a time so
// pages saved together don't overwrite each other's entries.
let indexQueue = Promise.resolve();
function updateIndex(change) {
  const run = async () => {
    const cache = await caches.open(PAGES_CACHE);
    const index = await readIndex(cache);
    const result = await change(index);
    await writeIndex(cache, index);
    return result;
  };
  const next = indexQueue.then(run, run);
  indexQueue = next.catch(() => {});
  return next;
}

async function readIndex(cache) {
  try {
    const res = await cache.match(INDEX_URL);
    if (res) return await res.json();
  } catch {
    // unreadable: start again
  }
  return { user: null, savedAt: null, pages: {} };
}

function writeIndex(cache, index) {
  return cache.put(INDEX_URL, new Response(JSON.stringify(index), { headers: { "content-type": "application/json" } }));
}

/** Drops the oldest entries over `max` (cache keys keep insertion order) */
async function trim(cache, max, keepUrls = []) {
  const keys = await cache.keys();
  const removable = keys.filter((k) => !keepUrls.includes(new URL(k.url).pathname));
  const extra = keys.length - max;
  for (let i = 0; i < extra && i < removable.length; i++) await cache.delete(removable[i]);
}

async function clearSaved() {
  await Promise.all([caches.delete(PAGES_CACHE), caches.delete(IMAGES_CACHE)]);
  await storeOfflinePage();
}

/**
 * Messages from the page:
 *   { type: "save", user, pages: [{ path, title }] }  keep these pages for offline use
 *   { type: "clear" }                                  forget everything (signing out)
 * Replies on the message port with { ok, saved, failed }.
 */
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  const reply = (body) => event.ports && event.ports[0] && event.ports[0].postMessage(body);

  if (msg.type === "clear") {
    event.waitUntil(clearSaved().then(() => reply({ ok: true })));
    return;
  }

  if (msg.type === "save" && typeof msg.user === "string" && Array.isArray(msg.pages)) {
    event.waitUntil(
      (async () => {
        // Someone else signed in on this device: their copies only
        const previousUser = await updateIndex((index) => {
          const before = index.user;
          index.user = msg.user;
          return before;
        });
        if (previousUser && previousUser !== msg.user) {
          await clearSaved();
          await updateIndex((index) => {
            index.user = msg.user;
          });
        }

        let saved = 0;
        let failed = 0;
        const pages = msg.pages.filter((p) => p && typeof p.path === "string" && isSaveable(p.path)).slice(0, MAX_PAGES);
        // A few at a time, so a phone on a slow connection isn't swamped
        for (let i = 0; i < pages.length; i += 3) {
          await Promise.all(
            pages.slice(i, i + 3).map(async ({ path, title }) => {
              try {
                const res = await fetch(path, { credentials: "same-origin", cache: "no-store" });
                if (!isHtmlPage(res)) throw new Error("not saved");
                await savePage(self.location.origin + path, res, typeof title === "string" ? title.slice(0, 120) : null);
                saved++;
              } catch {
                failed++;
              }
            }),
          );
        }
        await updateIndex((index) => {
          index.savedAt = Date.now();
        });
        reply({ ok: true, saved, failed });
      })(),
    );
  }
});
