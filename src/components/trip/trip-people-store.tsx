"use client";

import { useEffect, useSyncExternalStore } from "react";

// The people planning the open trip, for parts of the page that are loaded
// separately from the trip header (the booking form's "Who paid"). The header
// publishes them; anything below reads them for the same trip.

export type TripPeopleSnapshot = { tripId: string; viewerId: string; people: { id: string; name: string }[] };

let current: TripPeopleSnapshot | null = null;
const listeners = new Set<() => void>();

function publish(next: TripPeopleSnapshot | null) {
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Rendered by the trip header: makes the trip's people available below. */
export function ProvideTripPeople(props: TripPeopleSnapshot) {
  const key = `${props.tripId}|${props.viewerId}|${props.people.map((p) => `${p.id}:${p.name}`).join(",")}`;
  useEffect(() => {
    const snapshot = { tripId: props.tripId, viewerId: props.viewerId, people: props.people };
    publish(snapshot);
    return () => {
      if (current === snapshot) publish(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` covers the props
  }, [key]);
  return null;
}

/** The people planning `tripId`, once the header has loaded; null on other pages. */
export function useTripPeople(tripId: string): TripPeopleSnapshot | null {
  return useSyncExternalStore(
    subscribe,
    () => (current?.tripId === tripId ? current : null),
    () => null,
  );
}
