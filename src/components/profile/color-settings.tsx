"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COLOR_LABELS, COLOR_SECTIONS, customColorsCss, DEFAULT_COLORS, textOn, type ColorKey, type CustomColors } from "@/lib/colors";
import { saveColors } from "@/server/actions/profile";

const PREVIEW_ID = "user-colors-preview";

/**
 * Pick your own colour for every kind of item and every status. Changes show
 * across the page straight away as a preview, and stick once saved.
 */
export function ColorSettings({ saved }: { saved: CustomColors }) {
  const [colors, setColors] = useState<CustomColors>(saved);
  const [pending, startTransition] = useTransition();
  const value = (k: ColorKey) => colors[k] ?? DEFAULT_COLORS[k];
  const dirty = JSON.stringify(colors) !== JSON.stringify(saved);
  const custom = Object.keys(colors).length > 0;

  // Live preview: a style tag after everything else, removed when leaving the page
  useEffect(() => {
    let tag = document.getElementById(PREVIEW_ID) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = PREVIEW_ID;
      document.body.appendChild(tag);
    }
    // Only what changed: your picks, plus defaults for saved colours you've just reset
    const preview: CustomColors = { ...colors };
    for (const k of Object.keys(saved) as ColorKey[]) preview[k] ??= DEFAULT_COLORS[k];
    tag.textContent = dirty ? customColorsCss(preview) : "";
  }, [colors, saved, dirty]);
  useEffect(() => () => document.getElementById(PREVIEW_ID)?.remove(), []);

  function pick(key: ColorKey, hex: string) {
    setColors((c) => {
      const next = { ...c, [key]: hex };
      if (hex === DEFAULT_COLORS[key]) delete next[key];
      return next;
    });
  }

  function save(next: CustomColors | null) {
    startTransition(async () => {
      try {
        await saveColors(next);
        toast.success(next ? "Colours saved" : "Back to the standard colours");
        if (!next) setColors({});
      } catch {
        toast.error("Couldn't save your colours. Try again.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Pick the colours used for each kind of booking and each status, on every trip you look at. Only you see your choices.
      </p>

      {COLOR_SECTIONS.map((section) => (
        <fieldset key={section.title} className="space-y-2">
          <legend className="text-sm font-semibold">{section.title}</legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {section.keys.map((key) => (
              <li key={key}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-background px-3 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-md ring-1 ring-black/10"
                    style={{ background: value(key), color: textOn(value(key)) }}
                    aria-hidden
                  >
                    {/* Sample of a filled status circle: an icon, so any colour reads at 3:1 */}
                    <CheckIcon className="size-4" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{COLOR_LABELS[key]}</span>
                  <input
                    type="color"
                    value={value(key)}
                    onChange={(e) => pick(key, e.target.value)}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                    aria-label={`Colour for ${COLOR_LABELS[key]}`}
                  />
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" className="h-12" disabled={!dirty || pending} onClick={() => save(colors)}>
          {pending ? "Saving…" : "Save colours"}
        </Button>
        {custom || Object.keys(saved).length ? (
          <Button type="button" size="lg" variant="outline" className="h-12" disabled={pending} onClick={() => save(null)}>
            <RotateCcwIcon aria-hidden /> Use the standard colours
          </Button>
        ) : null}
      </div>
    </div>
  );
}
