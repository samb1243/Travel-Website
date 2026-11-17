"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { MapPinIcon, PencilLineIcon } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { flagEmoji } from "@/lib/format";
import { addStop, updateStop } from "@/server/actions/builder";
import type { Place } from "@/server/geocode";
import type { BuilderStop } from "@/server/trips";
import { PlaceSearch } from "./place-search";
import { ResponsiveSheet } from "./responsive-sheet";

type Location = Pick<Place, "name" | "region" | "country" | "countryCode" | "lat" | "lng" | "placeId">;

export type StopSheetState =
  | { mode: "add"; defaultArrive: string }
  | { mode: "edit"; stop: BuilderStop }
  | null;

export function StopSheet({
  tripId,
  state,
  onClose,
}: {
  tripId: string;
  state: StopSheetState;
  onClose: () => void;
}) {
  return (
    <ResponsiveSheet
      open={state !== null}
      onOpenChange={(o) => !o && onClose()}
      title={state?.mode === "edit" ? `Edit ${state.stop.name}` : "Add a stop"}
      description={state?.mode === "add" ? "A city, town or trailhead on your route." : undefined}
    >
      {/* Remount per opening so the form starts fresh */}
      {state ? (
        <StopForm key={state.mode === "edit" ? state.stop.id : "add"} tripId={tripId} state={state} onDone={onClose} />
      ) : null}
    </ResponsiveSheet>
  );
}

function StopForm({
  tripId,
  state,
  onDone,
}: {
  tripId: string;
  state: NonNullable<StopSheetState>;
  onDone: () => void;
}) {
  const editing = state.mode === "edit" ? state.stop : null;
  const [location, setLocation] = useState<Location | null>(
    editing && editing.lat !== null
      ? {
          name: editing.name,
          region: editing.region,
          country: editing.country,
          countryCode: editing.countryCode,
          lat: editing.lat,
          lng: editing.lng!,
          placeId: editing.placeId ?? "",
        }
      : null,
  );
  const [searching, setSearching] = useState(!editing);
  const [manual, setManual] = useState(Boolean(editing && editing.lat === null));
  const [name, setName] = useState(editing?.name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(place: Place) {
    setLocation(place);
    setName(place.name);
    setSearching(false);
    setManual(false);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      name,
      region: location?.region ?? "",
      country: location?.country ?? "",
      countryCode: location?.countryCode ?? "",
      placeId: location?.placeId ?? "",
      lat: location?.lat ?? null,
      lng: location?.lng ?? null,
      arriveOn: String(fd.get("arriveOn") ?? ""),
      departOn: String(fd.get("departOn") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const result = editing ? await updateStop(editing.id, input) : await addStop(tripId, input);
      if (result.ok) {
        toast.success(editing ? "Stop updated" : `${name} added`);
        onDone();
      } else {
        setErrors(result.errors ?? {});
        setFormError(result.message ?? (result.errors ? null : "Couldn't save the stop"));
      }
    });
  }

  const showForm = !searching || manual;

  return (
    <div className="space-y-5">
      {searching && !manual ? (
        <div className="space-y-3">
          <PlaceSearch onPick={pick} autoFocus />
          <Button type="button" variant="ghost" className="h-11 w-full" onClick={() => setManual(true)}>
            <PencilLineIcon aria-hidden /> Add without a location
          </Button>
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {location && !manual ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/50 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="text-xl" aria-hidden>
                  {location.countryCode ? flagEmoji(location.countryCode) : <MapPinIcon className="size-5" />}
                </span>
                <div className="min-w-0 text-sm">
                  <div className="truncate font-medium">{location.name}</div>
                  <div className="truncate text-muted-foreground">
                    {[location.region, location.country].filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSearching(true)}>
                Change
              </Button>
            </div>
          ) : null}

          <Field
            id="stop-name"
            label={manual ? "Name" : "Name (you can shorten it)"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="e.g. Chiang Mai"
          />
          {manual ? (
            <p className="-mt-2 text-sm text-muted-foreground">
              Without a location this stop won&apos;t appear on the map.{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => { setManual(false); setSearching(true); }}>
                Search instead
              </button>
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field
              id="arriveOn"
              name="arriveOn"
              type="date"
              label="Arrive"
              defaultValue={editing?.arriveOn ?? (state.mode === "add" ? state.defaultArrive : "")}
              error={errors.arriveOn}
            />
            <Field id="departOn" name="departOn" type="date" label="Leave" defaultValue={editing?.departOn ?? ""} error={errors.departOn} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stop-notes">Notes (optional)</Label>
            <Textarea
              id="stop-notes"
              name="notes"
              rows={3}
              defaultValue={editing?.notes ?? ""}
              placeholder="Neighbourhood to stay in, getting around, tips…"
              className="text-base md:text-sm"
            />
            {errors.notes ? <p className="text-sm text-destructive">{errors.notes}</p> : null}
          </div>

          <FormError message={formError ?? errors.lat ?? null} />
          <SubmitButton pending={pending}>{editing ? "Save stop" : "Add stop"}</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
