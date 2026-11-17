"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { RoutePoint } from "@/lib/route-map";
import { cn } from "@/lib/utils";

// Leaflet + OpenStreetMap tiles. Leaflet needs `window`, so it's loaded inside
// an effect rather than at import time.
//
// Security: stop names are user content, so they're only ever set with
// textContent. Leaflet's tooltip/popup string APIs treat strings as HTML.

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const PIN = "route-pin grid size-8 place-items-center rounded-full border-2 border-white bg-primary text-sm font-bold text-primary-foreground shadow-md transition-transform";
const PIN_SELECTED = "route-pin-selected";

export function RouteMap({
  points,
  selectedId,
  onSelect,
  className,
}: {
  points: RoutePoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  // Rebuild the map only when the route itself changes.
  const routeKey = points.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.number}`).join("|");

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    const markers = markersRef.current;

    (async () => {
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        scrollWheelZoom: false, // don't hijack page scrolling
        worldCopyJump: false,
      });
      mapRef.current = map;
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);

      const latLngs = points.map((p) => L.latLng(p.lat, p.lng));
      if (latLngs.length > 1) {
        L.polyline(latLngs, { className: "route-line", weight: 3, dashArray: "6 8", interactive: false }).addTo(map);
      }

      markers.clear();
      for (const p of points) {
        const label = document.createElement("span");
        label.textContent = p.name;
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: "", // drop Leaflet's default white box
            html: `<span class="${PIN}">${p.number}</span>`, // number only: never user text
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
          keyboard: true,
          title: `${p.number}. ${p.name}`, // set as an attribute, so it's safe
          riseOnHover: true,
        })
          .bindTooltip(label, { direction: "top", offset: [0, -16] })
          .on("click", () => onSelectRef.current(p.id))
          .addTo(map);
        markers.set(p.id, marker);
      }

      if (latLngs.length === 1) map.setView(latLngs[0], 10);
      else if (latLngs.length > 1) map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 11 });
      else map.setView([20, 0], 2);
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markers.clear();
    };
    // routeKey captures everything about `points` that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Highlight and fly to the selected stop.
  useEffect(() => {
    const map = mapRef.current;
    for (const [id, marker] of markersRef.current) {
      const pin = marker.getElement()?.querySelector(".route-pin");
      pin?.classList.toggle(PIN_SELECTED, id === selectedId);
      if (id === selectedId) marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(0);
    }
    const marker = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (map && marker) {
      map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 9), { duration: 0.6 });
      marker.openTooltip();
    }
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      // `isolate` keeps Leaflet's own z-indexes (up to 1000) below the sticky header and sheets.
      className={cn("route-map isolate z-0 overflow-hidden rounded-2xl border bg-muted", className)}
      role="region"
      aria-label="Map of the route"
    />
  );
}
