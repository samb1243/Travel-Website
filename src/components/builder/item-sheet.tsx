"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { LockIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_META, ITEM_CATEGORIES, LINK_KIND_META, LINK_KINDS } from "@/lib/item-categories";
import { ITEM_STATUSES, STATUS_META } from "@/lib/status";
import { MAX_LINKS } from "@/lib/validation/item";
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
  const [links, setLinks] = useState<LinkRow[]>(
    item?.links.map((l) => ({ key: l.id, kind: l.kind, label: l.label ?? "", url: l.url })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  const meta = CATEGORY_META[category];
  const defaultDate = state.mode === "add" ? state.defaultDate : "";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    const input = {
      stopId: get("stopId") || null,
      category,
      title: get("title"),
      provider: get("provider"),
      startDate: get("startDate"),
      startTime: get("startTime"),
      endDate: meta.fields.end ? get("endDate") : "",
      endTime: meta.fields.end ? get("endTime") : "",
      fromPlace: meta.fields.route ? get("fromPlace") : "",
      toPlace: meta.fields.route ? get("toPlace") : "",
      cost: get("cost"),
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
      <fieldset>
        <legend className="sr-only">What is it?</legend>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {ITEM_CATEGORIES.map((c) => {
            const m = CATEGORY_META[c];
            const Icon = m.icon;
            const active = c === category;
            return (
              <label
                key={c}
                className={cn(
                  "flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                )}
              >
                <input type="radio" name="category" value={c} checked={active} onChange={() => setCategory(c)} className="sr-only" />
                <Icon className="size-4" aria-hidden />
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
      {meta.fields.end ? (
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field id="endDate" name="endDate" type="date" label={meta.labels.end} defaultValue={dateOf(item?.endAt ?? null)} error={errors.endDate} />
          <Field id="endTime" name="endTime" type="time" label="Time" defaultValue={timeOf(item?.endAt ?? null)} error={errors.endTime} className="w-32" />
        </div>
      ) : null}
      <p className="-mt-3 text-xs text-muted-foreground">Times are local to where it happens. Leave the time empty for an all-day item.</p>

      {/* Status */}
      <fieldset className="space-y-2">
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

      <div className="grid grid-cols-2 gap-3">
        <Field id="cost" name="cost" inputMode="decimal" label={`Cost (${currency})`} placeholder="0" defaultValue={item?.cost ?? ""} error={errors.cost} />
        <Field id="provider" name="provider" label={meta.labels.provider} defaultValue={item?.provider ?? ""} error={errors.provider} />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">Total for everyone travelling, not per person.</p>

      {/* Links */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Links</legend>
        {links.map((l) => (
          <div key={l.key} className="space-y-2 rounded-xl border p-3">
            <div className="flex gap-2">
              <select
                aria-label="Link type"
                value={l.kind}
                onChange={(e) => updateLink(l.key, { kind: e.target.value as LinkKind })}
                className="h-11 rounded-lg border bg-transparent px-2 text-sm"
              >
                {LINK_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LINK_KIND_META[k].label}
                  </option>
                ))}
              </select>
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
          <LockIcon className="size-4 text-muted-foreground" aria-hidden /> Just for you
        </p>
        <p className="-mt-2 text-xs text-muted-foreground">Never shown on shared trips and removed when someone copies yours.</p>
        <Field id="confirmationCode" name="confirmationCode" label="Confirmation number" defaultValue={item?.confirmationCode ?? ""} error={errors.confirmationCode} autoComplete="off" />
        <div className="space-y-2">
          <Label htmlFor="privateNotes">Private notes</Label>
          <Textarea id="privateNotes" name="privateNotes" rows={2} defaultValue={item?.privateNotes ?? ""} placeholder="Seat numbers, door codes…" className="text-base md:text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stopId">Part of</Label>
        <select
          id="stopId"
          name="stopId"
          defaultValue={item ? (item.stopId ?? "") : state.mode === "add" ? (state.stopId ?? "") : ""}
          className="h-12 w-full rounded-lg border bg-transparent px-3 text-base md:text-sm"
        >
          {stops.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.name}
            </option>
          ))}
          <option value="">Whole trip (not tied to a stop)</option>
        </select>
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
