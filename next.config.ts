import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy. Not nonce-based on purpose: per-request nonces
// would switch off Partial Prerendering (the static page shells this app uses)
// and don't fit pages saved for offline use, so inline scripts (Next.js's own
// page data, the theme script) stay allowed. What it does enforce: scripts,
// styles and fonts only from this site, no fetching or posting data to other
// sites, no plugins, no frames. Images may come from any https site (cover
// photos, avatars and map tiles are links people choose).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`, // dev: hot reload
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'", // nobody may put Tripster in a frame (clickjacking)
].join("; ");

// Security headers for every response.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Share links carry the trip slug; don't leak full URLs to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Only takes effect over HTTPS, i.e. in production.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      // Every page, except tickets and documents (below)
      { source: "/((?!documents/).*)", headers: securityHeaders },
      {
        // Booking documents (PDFs open in the browser's own viewer, which a
        // no-plugins policy can block): everything but the page policy. The
        // route adds nosniff and no-referrer itself.
        source: "/documents/:id",
        headers: securityHeaders.filter((h) => h.key !== "Content-Security-Policy"),
      },
      {
        // The offline service worker: always check for a new version, same-origin scripts only
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
