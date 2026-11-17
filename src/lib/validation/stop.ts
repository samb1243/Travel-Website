import { z } from "zod";
import { optionalDate, optionalText } from "./common";

const coordinate = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable();

export const stopSchema = z
  .object({
    name: z.string().trim().min(1, "Give the stop a name").max(100, "Keep it under 100 characters"),
    region: optionalText(100),
    country: optionalText(100),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "Use a 2-letter country code")
      .transform((v) => (v === "" ? null : v)),
    placeId: z
      .string()
      .trim()
      .refine((v) => v === "" || /^osm:(node|way|relation):\d{1,15}$/.test(v), "Unknown place")
      .transform((v) => (v === "" ? null : v)),
    lat: coordinate(-90, 90),
    lng: coordinate(-180, 180),
    arriveOn: optionalDate,
    departOn: optionalDate,
    notes: optionalText(2000),
  })
  .superRefine((s, ctx) => {
    if ((s.lat === null) !== (s.lng === null)) {
      ctx.addIssue({ code: "custom", path: ["lat"], message: "A location needs both latitude and longitude" });
    }
    if (s.arriveOn && s.departOn && s.departOn < s.arriveOn) {
      ctx.addIssue({ code: "custom", path: ["departOn"], message: "Leave on or after the day you arrive" });
    }
  });

export type StopInput = z.input<typeof stopSchema>;

export const stopOrderSchema = z.array(z.string().min(1).max(40)).min(1).max(200);
