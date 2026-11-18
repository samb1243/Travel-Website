// The colour coding: one colour per status and per kind of item. Every view
// reads these as CSS variables (--k-<key>, plus --k-<key>-fg for text on top),
// so people can pick their own colours (Profile → Colours) and see them
// everywhere at once. Defaults live in globals.css; this file has the list,
// the labels and the maths.

export const COLOR_KEYS = [
  // What kind of thing an item is
  "travel",
  "stay",
  "do",
  "kit",
  // Booking
  "booked",
  "to-book",
  "not-needed",
  // Gear and other
  "bought",
  "to-buy",
  "have",
  // Payment
  "paid",
  "pay-on-arrival",
  "to-pay",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

export const COLOR_SECTIONS: { title: string; keys: ColorKey[] }[] = [
  { title: "Kinds of item", keys: ["travel", "stay", "do", "kit"] },
  { title: "Booking", keys: ["booked", "to-book", "not-needed"] },
  { title: "Gear and other", keys: ["bought", "to-buy", "have"] },
  { title: "Payment", keys: ["paid", "pay-on-arrival", "to-pay"] },
];

export const COLOR_LABELS: Record<ColorKey, string> = {
  travel: "Getting around",
  stay: "Places to stay",
  do: "Things to do",
  kit: "Gear & admin",
  booked: "Booked",
  "to-book": "To book",
  "not-needed": "No booking needed",
  bought: "Bought",
  "to-buy": "To buy",
  have: "Already have",
  paid: "Paid",
  "pay-on-arrival": "Pay on arrival",
  "to-pay": "To pay",
};

/** Default colours (light theme), also the starting point of the colour picker */
export const DEFAULT_COLORS: Record<ColorKey, string> = {
  travel: "#4f46e5",
  stay: "#b0308c",
  do: "#d23a52",
  kit: "#8a5a36",
  booked: "#10b981",
  "to-book": "#f59e0b",
  "not-needed": "#a1a1aa",
  bought: "#10b981",
  "to-buy": "#f59e0b",
  have: "#64748b",
  paid: "#0d9488",
  "pay-on-arrival": "#0ea5e9",
  "to-pay": "#ea580c",
};

export type CustomColors = Partial<Record<ColorKey, string>>;

const HEX = /^#[0-9a-f]{6}$/i;

/** Keeps only known keys with "#rrggbb" values; anything else is dropped. */
export function cleanCustomColors(value: unknown): CustomColors {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CustomColors = {};
  for (const key of COLOR_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "string" && HEX.test(v)) out[key] = v.toLowerCase();
  }
  return out;
}

/** Black or white, whichever reads better on the given colour (WCAG luminance). */
export function textOn(hex: string): "#ffffff" | "#14231f" {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against white vs against near-black
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.0638) ? "#ffffff" : "#14231f";
}

/** Only the colours that differ from the defaults (what's worth saving) */
export function changedColors(colors: CustomColors): CustomColors {
  return Object.fromEntries(Object.entries(colors).filter(([k, v]) => DEFAULT_COLORS[k as ColorKey] !== v));
}

/** CSS that applies someone's colours on top of the defaults, in both themes. */
export function customColorsCss(colors: CustomColors): string {
  const decls = Object.entries(colors)
    .map(([k, v]) => `--k-${k}:${v};--k-${k}-fg:${textOn(v!)};--k-${k}-ink:${v};`)
    .join("");
  return decls ? `:root:root,:root.dark{${decls}}` : "";
}

/** Matches CSS made by customColorsCss, to check a copy kept in the browser before using it */
export const CUSTOM_COLORS_CSS = /^(:root:root,:root\.dark\{(--k-[a-z-]+:#[0-9a-f]{6};)+\})?$/;
