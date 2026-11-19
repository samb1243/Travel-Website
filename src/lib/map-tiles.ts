// Where the trip maps get their tiles. With NEXT_PUBLIC_MAPTILER_KEY set:
// MapTiler's OpenStreetMap-based streets map (free tier: 100,000 tile loads a
// month). Without it: OpenStreetMap's own tile servers, which are fine for
// development but don't allow app traffic (https://operations.osmfoundation.org/policies/tiles/).
//
// The MapTiler key is public by design (the browser fetches tiles with it);
// restrict it to your domain in MapTiler's dashboard.

export type TileSource = { url: string; attribution: string; maxZoom: number };

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

export function tileSource(maptilerKey: string | undefined = process.env.NEXT_PUBLIC_MAPTILER_KEY): TileSource {
  const key = maptilerKey?.trim();
  if (key && /^[A-Za-z0-9_-]{8,64}$/.test(key)) {
    return {
      url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${key}`,
      attribution: `<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">&copy; MapTiler</a> ${OSM_ATTRIBUTION}`,
      maxZoom: 20,
    };
  }
  return { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: OSM_ATTRIBUTION, maxZoom: 19 };
}
