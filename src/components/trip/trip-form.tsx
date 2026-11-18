"use client";

import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/auth/form-bits";
import { ImagePicker } from "@/components/image-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES } from "@/lib/currencies";
import { MAX_TRIP_TYPES, normaliseTripTypes, TRIP_TYPE_META, TRIP_TYPES } from "@/lib/trip-types";
import { cn } from "@/lib/utils";
import type { TripType } from "@/generated/prisma/enums";
import type { TripFormState } from "@/server/actions/trips";

export type TripFormDefaults = {
  title: string;
  /** May be empty for a new trip: the user picks */
  types: TripType[];
  startDate: string;
  endDate: string;
  currency: string;
  budget: string;
  travellers: string;
  description: string;
  coverImageUrl: string;
};

export function TripForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
}: {
  action: (prev: TripFormState, formData: FormData) => Promise<TripFormState>;
  defaults: TripFormDefaults;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [types, setTypes] = useState<TripType[]>(defaults.types);
  const toggleType = (t: TripType) =>
    setTypes((current) =>
      current.includes(t) ? current.filter((x) => x !== t) : normaliseTripTypes([...current, t]),
    );
  const full = types.length >= MAX_TRIP_TYPES;
  const [currency, setCurrency] = useState(defaults.currency);
  const [cover, setCover] = useState(defaults.coverImageUrl);
  const errors = state.errors ?? {};
  // Open "More details" up front when editing, or when one of its fields has an error.
  const detailErrors = ["currency", "budget", "travellers", "description", "coverImageUrl"].some((k) => errors[k]);
  const [showMore, setShowMore] = useState(
    Boolean(defaults.budget || defaults.description || defaults.coverImageUrl || defaults.travellers !== "1"),
  );

  // Submit via a handler (not <form action>) so React doesn't reset the
  // fields after the action; see profile-form.tsx.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Field
        id="title"
        name="title"
        label="Trip name"
        placeholder="e.g. Three weeks in Southeast Asia"
        defaultValue={defaults.title}
        autoFocus={!defaults.title}
        error={errors.title}
      />

      <fieldset className="min-w-0 space-y-2" aria-describedby="types-hint">
        <legend className="text-sm font-medium">Type of trip</legend>
        <p id="types-hint" className="text-sm text-muted-foreground">
          Pick all that fit, up to {MAX_TRIP_TYPES}. People filter by these on Explore.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {TRIP_TYPES.map((t) => {
            const meta = TRIP_TYPE_META[t];
            const Icon = meta.icon;
            const on = types.includes(t);
            const disabled = !on && full;
            return (
              <label
                key={t}
                title={meta.description}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : disabled
                      ? "cursor-not-allowed bg-card text-muted-foreground opacity-50"
                      : "cursor-pointer bg-card hover:bg-accent",
                )}
              >
                <input
                  type="checkbox"
                  name="types"
                  value={t}
                  checked={on}
                  disabled={disabled}
                  onChange={() => toggleType(t)}
                  className="sr-only"
                />
                {on ? <CheckIcon className="size-4" strokeWidth={3} aria-hidden /> : <Icon className="size-4" aria-hidden />}
                {meta.label}
              </label>
            );
          })}
        </div>
        {errors.types ? <p className="text-sm text-destructive">{errors.types}</p> : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field id="startDate" name="startDate" type="date" label="Start" defaultValue={defaults.startDate} error={errors.startDate} />
        <Field id="endDate" name="endDate" type="date" label="End" defaultValue={defaults.endDate} error={errors.endDate} />
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">Not sure yet? Leave the dates empty and add them later.</p>

      <div className="rounded-2xl border">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore || detailErrors}
          className="flex h-12 w-full items-center justify-between px-4 text-sm font-medium"
        >
          Budget, travellers and more
          <ChevronDownIcon className={cn("size-4 transition-transform", (showMore || detailErrors) && "rotate-180")} />
        </button>
        {/* Kept mounted (just hidden) so the values are always submitted. */}
        <div className={cn("space-y-4 border-t p-4", !(showMore || detailErrors) && "hidden")}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="travellers"
              name="travellers"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              label="Travellers"
              defaultValue={defaults.travellers}
              error={errors.travellers}
            />
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select name="currency" value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency" className="w-full text-base data-[size=default]:h-12 md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currency ? <p className="text-sm text-destructive">{errors.currency}</p> : null}
            </div>
          </div>
          <Field
            id="budget"
            name="budget"
            inputMode="decimal"
            label={`Total budget (${currency}, optional)`}
            placeholder="e.g. 2500"
            defaultValue={defaults.budget}
            hint="For the whole group. The Budget tab shows per person and per day."
            error={errors.budget}
          />
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={defaults.description}
              placeholder="What's the idea of this trip? Shown to others if you share it."
              aria-invalid={errors.description ? true : undefined}
              className="text-base md:text-sm"
            />
            {errors.description ? <p className="text-sm text-destructive">{errors.description}</p> : null}
          </div>
          <div className="space-y-1.5">
            <ImagePicker name="coverImageUrl" value={cover} onChange={setCover} label="Cover photo (optional)" error={errors.coverImageUrl} />
            <p className="text-xs text-muted-foreground">Upload one or paste a link. Without one, the trip gets a colour gradient.</p>
          </div>
        </div>
      </div>

      <FormError message={state.message} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost" size="lg" className="h-12">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <SubmitButton pending={pending} className="h-12 sm:w-auto sm:px-8">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
