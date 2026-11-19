// "Ideas from other travellers": what other people booked or planned in the
// same place, from public trips only. Pure functions (unit-tested); the
// database side is src/server/recommendations.ts.
//
// Privacy: an idea is shown only when at least MIN_TRAVELLERS different people
// have it in a public trip, so nothing points back to one person's plans. Only
// what public trip pages already show is used (names, kind, place, address,
// price); never notes, confirmations or who planned it.

import type { ItemCategory } from "@/generated/prisma/enums";

export const MIN_TRAVELLERS = 3;
/** Things tied to a place; flights, gear and paperwork depend on the traveller instead */
export const IDEA_CATEGORIES = ["ACCOMMODATION", "ACTIVITY", "FOOD", "TRANSPORT"] as const satisfies readonly ItemCategory[];
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];
export const MAX_IDEAS = 30;

/** One item from someone else's public trip at the same place */
export type IdeaSource = {
  ownerId: string;
  category: IdeaCategory;
  title: string;
  provider: string | null;
  address: string | null;
  /** Price in the viewer's trip currency: per person, or per night for stays; null if unknown */
  price: number | null;
};

export type Idea = {
  key: string;
  category: IdeaCategory;
  title: string;
  provider: string | null;
  address: string | null;
  /** How many different travellers have it */
  travellers: number;
  /** Median price in the viewer's currency, when at least two travellers priced it */
  typicalPrice: number | null;
  priceBasis: "person" | "night";
  /** Already in the viewer's own plans for this stop */
  alreadyPlanned: boolean;
};

/** Notes in brackets ("(3 nights)", "(morning)") and punctuation don't make a different place */
export const cleanTitle = (title: string) => title.replace(/\s*[([].*?[)\]]\s*/g, " ").replace(/\s+/g, " ").trim();

/** Same kind + same name (ignoring case, "&" vs "and", punctuation, accents) = the same idea */
export function ideaKey(category: ItemCategory, title: string): string {
  const words = cleanTitle(title)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return `${category}:${words}`;
}

function mostCommon(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Most common, then the shortest (tidiest) spelling
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]?.[0] ?? null;
}

function median(values: number[]): number | null {
  if (values.length < 2) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100;
}

/**
 * Groups other travellers' items into ideas: same kind and name, had by at
 * least `min` different people (one vote per person, however many trips).
 * Most popular first.
 */
export function buildIdeas(sources: IdeaSource[], ownTitles: { category: ItemCategory; title: string }[], min = MIN_TRAVELLERS): Idea[] {
  const own = new Set(ownTitles.map((t) => ideaKey(t.category, t.title)));
  const groups = new Map<string, IdeaSource[]>();
  for (const s of sources) {
    const key = ideaKey(s.category, s.title);
    if (key.endsWith(":")) continue; // no name left
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const ideas: Idea[] = [];
  for (const [key, list] of groups) {
    // One entry per traveller: their first (later trips by the same person don't add votes)
    const perTraveller = [...new Map(list.map((s) => [s.ownerId, s] as const)).values()];
    if (perTraveller.length < min) continue;
    const prices = list.map((s) => s.price).filter((p): p is number => p !== null && p > 0);
    const byPerson = new Map<string, number>();
    for (const s of list) if (s.price !== null && s.price > 0 && !byPerson.has(s.ownerId)) byPerson.set(s.ownerId, s.price);
    ideas.push({
      key,
      category: list[0].category,
      title: mostCommon(list.map((s) => cleanTitle(s.title)))!,
      provider: mostCommon(list.map((s) => s.provider)),
      address: mostCommon(list.map((s) => s.address)),
      travellers: perTraveller.length,
      typicalPrice: prices.length ? median([...byPerson.values()]) : null,
      priceBasis: list[0].category === "ACCOMMODATION" ? "night" : "person",
      alreadyPlanned: own.has(key),
    });
  }

  const order = IDEA_CATEGORIES as readonly string[];
  return ideas
    .sort((a, b) => b.travellers - a.travellers || order.indexOf(a.category) - order.indexOf(b.category) || a.title.localeCompare(b.title))
    .slice(0, MAX_IDEAS);
}
