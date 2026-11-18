import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/brand";

// Lets people add Tripster to their phone's home screen, where it opens like
// an app (no browser bar). Icons come from scripts/make-icons.mts.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Your trips, bookings and confirmation numbers in one place, also offline.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#eef2f0",
    theme_color: "#1c3a32",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
