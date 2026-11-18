"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { LockIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_META, GROUP_META, ITEM_CATEGORIES, itemGroup, LINK_KIND_META, LINK_KINDS } from "@/lib/item-categories";
import { ITEM_STATUSES, STATUS_META } from "@/lib/status";
import { MAX_LINKS } from "@/lib/validation/item";
import { CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import type { ItemCategory, ItemStatus, LinkKind } from "@/generated/prisma/enums";
import { deleteItem, saveItem } from "@/server/actions/builder";
import type { BuilderItem, BuilderStop } from "@/server/trips";
import { ResponsiveSheet } from "./responsive-sheet";

export type ItemSheetState =
  | { mode: "add"; stopId: string | null; defaultDate: string; category?: ItemCategory }
  | { mode: "edit"; item: BuilderItem }
  | null;

export function ItemSheet({
  tripId,
  currency,
  stops,
  state,
  onClose,
}: {
  tripId: string;
  currency: string;
  stops: Pick<BuilderStop, "id" | "name">[];
  state: ItemSheetState;
  onClose: () => void;
}) {
  return (
    <ResponsiveSheet
      open={state !== null}
      onOpenChange={(o) => !o && onClose()}
      title={state?.mode === "edit" ? "Edit" : "Add to your trip"}
    >
      {state ? (
        <ItemForm
          key={state.mode === "edit" ? state.item.id : `add-${state.stopId}`}
          tripId={tripId}
          currency={currency}
          stops={stops}
          state={state}
          onDone={onClose}
        />
      ) : null}
    </ResponsiveSheet>
  );
}

const WHOLE_TRIP = "__whole_trip";

type LinkRow = { key: string; kind: LinkKind; label: string; url: string };

const dateOf = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const timeOf = (iso: string | null) => {
  if (!iso) return "";
  const t = iso.slice(11, 16);
  return t === "00:00" ? "" : t;
};

function ItemForm({
  tripId,
  currency,
  stops,
  state,
  onDone,
}: {
  tripId: string;
  currency: string;
  stops: Pick<BuilderStop, "id" | "name">[];
  state: NonNullable<ItemSheetState>;
  onDone: () => void;
}) {
  const item = state.mode === "edit" ? state.item : null;
  const [category, setCategory] = useState<ItemCategory>(item?.category ?? (state.mode === "add" ? state.category : undefined) ?? "ACTIVITY");
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? "TO_BOOK");
  // Which stop it belongs to; WHOLE_TRIP = not tied to a stop.
  const [stopId, setStopId] = useState<string>(
    (item ? item.stopId : state.mode === "add" ? state.stopId : null) ?? WHOLE_TRIP,
  );
  // Free = a price of 0. An empty price means "not priced yet", which the budget treats differently.
  const [free, setFree] = useState(item?.cost === 0);
  // The price's currency; defaults to the trip's.
  const [priceCurrency, setPriceCurrency] = useState(item?.currency ?? currency);
  const [links, setLinks] = useState<LinkRow[]>(
    item?.links.map((l) => ({ key: l.id, kind: l.kind, label: l.label ?? "", url: l.url })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  const meta = CATEGORY_META[category];
  // Activities and food only ask for an end time when you want one.
  const [addEnd, setAddEnd] = useState(Boolean(item?.endAt));
  const showEnd = meta.fields.end === true || (meta.fields.end === "optional" && addEnd);
  const defaultDate = state.mode === "add" ? state.defaultDate : "";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    const input = {
      stopId: stopId === WHOLE_TRIP ? null : stopId,
      category,
      title: get("title"),
      provider: get("provider"),
      startDate: get("startDate"),
      startTime: get("startTime"),
      endDate: showEnd ? get("endDate") : "",
      endTime: showEnd ? get("endTime") : "",
      fromPlace: meta.fields.route ? get("fromPlace") : "",
      toPlace: meta.fields.route ? get("toPlace") : "",
      cost: free ? "0" : get("cost"),
      currency: free || priceCurrency === currency ? "" : priceCurrency,
      status,
      confirmationCode: get("confirmationCode"),
      notes: get("notes"),
      privateNotes: get("privateNotes"),
      links: links
        .filter((l) => l.url.trim())
        .map((l) => ({ kind: l.kind, label: l.label, url: l.url.trim() })),
    };
    startTransition(async () => {
      const result = await saveItem(tripId, item?.id ?? null, input);
      if (result.ok) {
        toast.success(item ? "Saved" : "Added");
        onDone();
      } else {
        setErrors(result.errors ?? {});
        setFormError(result.message ?? (result.errors ? "Check the highlighted fields" : "Couldn't save"));
      }
    });
  }

  function onDelete() {
    if (!item || !window.confirm(`Delete “${item.title}”?`)) return;
    startDelete(async () => {
      const result = await deleteItem(item.id);
      if (result.ok) {
        toast.success("Deleted");
        onDone();
      } else setFormError("Couldn't delete");
    });
  }

  const updateLink = (key: string, patch: Partial<LinkRow>) =>
    setLinks((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {/* Category chips */}
      {/* min-w-0: a fieldset otherwise grows to fit its contents and pushes the form sideways */}
      <fieldset className="min-w-0">
        <legend className="sr-only">What is it?</legend>
        {/* All 7 types visible at once: a 4-column grid of tiles, no sideways scrolling */}
        <div className="grid grid-cols-4 gap-2">
          {ITEM_CATEGORIES.map((c) => {
            const m = CATEGORY_META[c];
            const Icon = m.icon;
            const active = c === category;
            return (
              <label
                key={c}
                className={cn(
                  "flex min-h-16 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-center text-xs leading-tight font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                <input type="radio" name="category" value={c} checked={active} onChange={() => setCategory(c)} className="sr-only" />
                <Icon className={cn("size-4", !active && GROUP_META[itemGroup(c)].text)} aria-hidden />
                {m.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      {meta.fields.route ? (
        <div className="grid grid-cols-2 gap-3">
          <Field id="fromPlace" name="fromPlace" label="From" defaultValue={item?.fromPlace ?? ""} error={errors.fromPlace} placeholder="Bangkok (BKK)" />
          <Field id="toPlace" name="toPlace" label="To" defaultValue={item?.toPlace ?? ""} error={errors.toPlace} placeholder="Chiang Mai" />
        </div>
      ) : null}

      <Field
        id="title"
        name="title"
        label={meta.labels.title}
        placeholder={meta.labels.titlePlaceholder}
        defaultValue={item?.title ?? ""}
        error={errors.title}
        autoFocus={!item && !meta.fields.route}
      />

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field id="startDate" name="startDate" type="date" label={meta.labels.start} defaultValue={item ? dateOf(item.startAt) : defaultDate} error={errors.startDate} />
        <Field id="startTime" name="startTime" type="time" label="Time" defaultValue={item && !item.allDay ? timeOf(item.startAt) : ""} error={errors.startTime} className="w-32" />
      </div>
      {showEnd ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field id="endDate" name="endDate" type="date" label={meta.labels.end} defaultValue={dateOf(item?.endAt ?? null)} error={errors.endDate} />
            <Field id="endTime" name="endTime" type="time" label="Time" defaultValue={timeOf(item?.endAt ?? null)} error={errors.endTime} className="w-32" />
          </div>
          {meta.fields.end === "optional" ? (
            <button
              type="button"
              onClick={() => setAddEnd(false)}
              className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Remove end time
            </button>
          ) : null}
        </div>
      ) : meta.fields.end === "optional" ? (
        <Button type="button" variant="ghost" className="-mt-2 h-10 justify-start rounded-xl px-2 font-semibold text-muted-foreground" onClick={() => setAddEnd(true)}>
          <PlusIcon aria-hidden /> Add end time
        </Button>
      ) : null}
      <p className="-mt-3 text-xs text-muted-foreground">Times are local to where it happens. Leave the time empty for an all-day item.</p>

      {/* Status */}
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">Booking status</legend>
        <div className="grid grid-cols-2 gap-2">
          {ITEM_STATUSES.map((s) => {
            const m = STATUS_META[s];
            const active = s === status;
            return (
              <label
                key={s}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  active ? m.badge : "bg-card text-muted-foreground hover:bg-accent",
                )}
              >
                <input type="radio" name="status" value={s} checked={active} onChange={() => setStatus(s)} className="sr-only" />
                <span aria-hidden>{m.emoji}</span>
                {m.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field
            key={free ? "free" : "paid"}
            id="cost"
            name="cost"
            inputMode="decimal"
            label="Cost"
            placeholder={free ? "Free" : "0"}
            disabled={free}
            defaultValue={free ? "" : (item?.cost ?? "")}
            error={free ? undefined : errors.cost}
          />
          <div className="space-y-2">
            <Label htmlFor="priceCurrency" className="sr-only">
              Currency
            </Label>
            <Select value={priceCurrency} onValueChange={setPriceCurrency} disabled={free}>
              <SelectTrigger id="priceCurrency" aria-label="Currency" className="w-28 rounded-lg text-base font-semibold data-[size=default]:h-12 md:text-sm">
                {/* Just the code here; the list shows the full names */}
                <SelectValue>{priceCurrency}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="min-h-10">
                    <span className="font-semibold">{c.code}</span>
                    <span className="text-muted-foreground">{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {errors.currency ? <p className="text-sm text-destructive">{errors.currency}</p> : null}
        <label
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border px-4 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            free
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-card hover:bg-accent",
          )}
        >
          <input
            type="checkbox"
            checked={free}
            onChange={(e) => setFree(e.target.checked)}
            className="size-4 accent-emerald-600"
          />
          It&apos;s free
        </label>
        <p className="text-xs text-muted-foreground">
          {free ? "Counts as free in the budget." : "Total for everyone travelling, not per person. Leave it empty if you don't know yet."}
        </p>
        {priceCurrency !== currency && !free ? (
          <p className="text-xs text-muted-foreground">
            Shown in {priceCurrency}, and converted to {currency} for the budget at today&apos;s rate.
          </p>
        ) : null}
      </div>

      <Field id="provider" name="provider" label={meta.labels.provider} defaultValue={item?.provider ?? ""} error={errors.provider} />

      {/* Links */}
      <fieldset className="min-w-0 space-y-2">
        <legend className="text-sm font-medium">Links</legend>
        {links.map((l) => (
          <div key={l.key} className="space-y-2 rounded-xl border p-3">
            <div className="flex gap-2">
              <Select value={l.kind} onValueChange={(v) => updateLink(l.key, { kind: v as LinkKind })}>
                <SelectTrigger aria-label="Link type" className="w-36 shrink-0 rounded-lg data-[size=default]:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINK_KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="min-h-10">
                      {LINK_KIND_META[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Button text (optional)"
                placeholder="Button text (optional)"
                value={l.label}
                onChange={(e) => updateLink(l.key, { label: e.target.value })}
                className="h-11"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label="Remove link"
                onClick={() => setLinks((rows) => rows.filter((r) => r.key !== l.key))}
              >
                <XIcon aria-hidden />
              </Button>
            </div>
            <Input
              aria-label="Link address"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={l.url}
              onChange={(e) => updateLink(l.key, { url: e.target.value })}
              className="h-11"
            />
            {LINK_KIND_META[l.kind].hint ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LockIcon className="size-3" aria-hidden /> {LINK_KIND_META[l.kind].hint}
              </p>
            ) : null}
          </div>
        ))}
        {errors.links ? <p className="text-sm text-destructive">{errors.links}</p> : null}
        {links.length < MAX_LINKS ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() =>
              setLinks((rows) => [
                ...rows,
                { key: crypto.randomUUID(), kind: rows.length === 0 ? "BOOKING" : "OTHER", label: "", url: "" },
              ])
            }
          >
            <PlusIcon aria-hidden /> Add a link
          </Button>
        ) : null}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={item?.notes ?? ""} placeholder="Tips, what to bring, how to get there…" className="text-base md:text-sm" />
        {errors.notes ? <p className="text-sm text-destructive">{errors.notes}</p> : null}
      </div>

      {/* Personal details */}
      <div className="space-y-4 rounded-2xl border border-dashed p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <LockIcon className="size-4 text-muted-foreground" aria-hidden /> Private to your group
        </p>
        <p className="-mt-2 text-xs text-muted-foreground">
          Only you and the people planning this trip see these. Never shown on shared trips or copied.
        </p>
        <Field id="confirmationCode" name="confirmationCode" label="Confirmation number" defaultValue={item?.confirmationCode ?? ""} error={errors.confirmationCode} autoComplete="off" />
        <div className="space-y-2">
          <Label htmlFor="privateNotes">Private notes</Label>
          <Textarea id="privateNotes" name="privateNotes" rows={2} defaultValue={item?.privateNotes ?? ""} placeholder="Seat numbers, door codes…" className="text-base md:text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stopId">Part of</Label>
        <Select value={stopId} onValueChange={setStopId}>
          <SelectTrigger id="stopId" className="w-full rounded-lg text-base data-[size=default]:h-12 md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stops.map((s, i) => (
              <SelectItem key={s.id} value={s.id} className="min-h-11">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-foreground bg-trail text-xs font-black text-trail-foreground">
                  {i + 1}
                </span>
                {s.name}
              </SelectItem>
            ))}
            {stops.length ? <SelectSeparator /> : null}
            <SelectItem value={WHOLE_TRIP} className="min-h-11">
              Whole trip (not tied to a stop)
            </SelectItem>
          </SelectContent>
        </Select>
        {errors.stopId ? <p className="text-sm text-destructive">{errors.stopId}</p> : null}
      </div>

      <FormError message={formError} />
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-popover/95 px-4 py-3 backdrop-blur">
        <SubmitButton pending={pending}>{item ? "Save" : "Add"}</SubmitButton>
        {item ? (
          <Button type="button" variant="ghost" className="h-11 text-destructive hover:text-destructive" onClick={onDelete} disabled={deleting}>
            <Trash2Icon aria-hidden /> Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}
