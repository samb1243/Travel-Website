// Hard caps so a single account can't fill the database, whatever it sends.
// Generous for real trips (the biggest demo trip has 7 stops and 34 items).

export const MAX_TRIPS_PER_USER = 200;
export const MAX_STOPS_PER_TRIP = 100;
export const MAX_ITEMS_PER_TRIP = 500;
// Links per item: MAX_LINKS in src/lib/validation/item.ts
