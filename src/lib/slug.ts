const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no look-alikes (l/1, o/0)

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** 10 random chars ≈ 50 bits: unguessable enough for unlisted share links. */
export function randomSuffix(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** e.g. "tour-du-mont-blanc-k3n8q2x7ma" */
export function makeTripSlug(title: string, suffix = randomSuffix()): string {
  const base = slugify(title) || "trip";
  return `${base}-${suffix}`;
}
