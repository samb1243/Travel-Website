// Links that open a place, or a route, in Google Maps or Apple Maps. Built from
// what the traveller typed; nothing is looked up or sent anywhere by the app.

export type MapLink = { label: "Google Maps" | "Apple Maps"; href: string };

type Placed = {
  address: string | null;
  fromPlace: string | null;
  toPlace: string | null;
  title: string;
};

const q = encodeURIComponent;

/** Map links for an item: its address, else directions from → to. Empty if there's neither. */
export function mapLinksFor(item: Placed): MapLink[] {
  if (item.address) {
    // The name helps the map find the right building ("Lub d Hostel, 4 Decho Rd")
    const query = item.address.toLowerCase().includes(item.title.toLowerCase()) ? item.address : `${item.title}, ${item.address}`;
    return [
      { label: "Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${q(query)}` },
      { label: "Apple Maps", href: `https://maps.apple.com/?q=${q(query)}` },
    ];
  }
  if (item.fromPlace && item.toPlace) {
    return [
      {
        label: "Google Maps",
        href: `https://www.google.com/maps/dir/?api=1&origin=${q(item.fromPlace)}&destination=${q(item.toPlace)}`,
      },
      { label: "Apple Maps", href: `https://maps.apple.com/?saddr=${q(item.fromPlace)}&daddr=${q(item.toPlace)}` },
    ];
  }
  return [];
}
