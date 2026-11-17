import { z } from "zod";
import { ITEM_CATEGORIES, LINK_KINDS } from "@/lib/item-categories";
import { ITEM_STATUSES } from "@/lib/status";
import { atTime } from "@/lib/dates";
import { optionalDate, optionalMoney, optionalText, optionalTime } from "./common";

export const MAX_LINKS = 10;

export const linkSchema = z.object({
  kind: z.enum(LINK_KINDS),
  label: optionalText(60),
  url: z
    .string()
    .trim()
    .max(2000, "That link is too long")
    // Only web links: blocks javascript:, data: and other schemes.
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, "Use a full link starting with https://"),
});

export const itemSchema = z
  .object({
    stopId: z.string().min(1).max(40).nullable(),
    category: z.enum(ITEM_CATEGORIES),
    title: optionalText(150),
    provider: optionalText(100),
    startDate: optionalDate,
    startTime: optionalTime,
    endDate: optionalDate,
    endTime: optionalTime,
    fromPlace: optionalText(150),
    toPlace: optionalText(150),
    cost: optionalMoney,
    status: z.enum(ITEM_STATUSES),
    confirmationCode: optionalText(100),
    notes: optionalText(2000),
    privateNotes: optionalText(2000),
    links: z.array(linkSchema).max(MAX_LINKS, `${MAX_LINKS} links at most`),
  })
  .superRefine((v, ctx) => {
    if (!v.title && !(v.fromPlace && v.toPlace)) {
      ctx.addIssue({ code: "custom", path: ["title"], message: "Give it a name" });
    }
    if (v.startTime && !v.startDate) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Add a date for this time" });
    }
    if (v.endTime && !v.endDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Add a date for this time" });
    }
    if (v.endDate && !v.startDate) {
      ctx.addIssue({ code: "custom", path: ["startDate"], message: "Add a start date too" });
    }
    if (v.startDate && v.endDate) {
      const start = v.startTime ? atTime(v.startDate, v.startTime) : v.startDate;
      const end = v.endTime ? atTime(v.endDate, v.endTime) : v.endDate;
      if (end < start) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ends before it starts" });
    }
  })
  .transform((v) => ({
    stopId: v.stopId,
    category: v.category,
    // Transport without a name gets "Bangkok → Chiang Mai"
    title: v.title ?? `${v.fromPlace} → ${v.toPlace}`,
    provider: v.provider,
    startAt: v.startDate ? (v.startTime ? atTime(v.startDate, v.startTime) : v.startDate) : null,
    endAt: v.endDate ? (v.endTime ? atTime(v.endDate, v.endTime) : v.endDate) : null,
    allDay: Boolean(v.startDate && !v.startTime),
    fromPlace: v.fromPlace,
    toPlace: v.toPlace,
    cost: v.cost,
    status: v.status,
    confirmationCode: v.confirmationCode,
    notes: v.notes,
    privateNotes: v.privateNotes,
    links: v.links,
  }));

export type ItemFormInput = z.input<typeof itemSchema>;
export type ItemData = z.output<typeof itemSchema>;
