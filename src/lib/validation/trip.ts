import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/currencies";
import { daysBetween } from "@/lib/dates";
import { optionalDate as dateOnly, optionalMoney as money, optionalText, optionalImageUrl } from "./common";
import { MAX_TRIP_TYPES, normaliseTripTypes, TRIP_TYPES } from "@/lib/trip-types";

export const tripSchema = z
  .object({
    title: z.string().trim().min(1, "Give your trip a name").max(100, "Keep it under 100 characters"),
    types: z
      .array(z.enum(TRIP_TYPES, "Pick from the list"))
      .min(1, "Pick at least one type")
      .max(MAX_TRIP_TYPES, `Pick up to ${MAX_TRIP_TYPES} types`)
      .transform(normaliseTripTypes),
    startDate: dateOnly,
    endDate: dateOnly,
    currency: z.enum(CURRENCY_CODES, "Pick a currency from the list"),
    budget: money,
    travellers: z.coerce
      .number("Enter a number")
      .int("Enter a whole number")
      .min(1, "At least 1 traveller")
      .max(50, "50 travellers at most"),
    description: optionalText(2000, "Keep it under 2,000 characters"),
    coverImageUrl: optionalImageUrl,
  })
  .superRefine((t, ctx) => {
    if (!!t.startDate !== !!t.endDate) {
      ctx.addIssue({
        code: "custom",
        path: [t.startDate ? "endDate" : "startDate"],
        message: "Add both dates, or leave both empty",
      });
      return;
    }
    if (t.startDate instanceof Date && t.endDate instanceof Date) {
      const span = daysBetween(t.startDate, t.endDate);
      if (span < 0) ctx.addIssue({ code: "custom", path: ["endDate"], message: "The trip has to end after it starts" });
      else if (span > 365) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Trips can be a year long at most" });
    }
  });

export type TripInput = z.output<typeof tripSchema>;

/** Reads the trip form fields out of FormData (missing fields become ""). */
export function tripFormValues(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "");
  return {
    title: get("title"),
    types: formData.getAll("types").map(String),
    startDate: get("startDate"),
    endDate: get("endDate"),
    currency: get("currency"),
    budget: get("budget"),
    travellers: get("travellers") || "1",
    description: get("description"),
    coverImageUrl: get("coverImageUrl"),
  };
}
