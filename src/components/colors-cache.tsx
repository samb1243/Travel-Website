"use client";

import { useEffect } from "react";
import { CUSTOM_COLORS_CSS } from "@/lib/colors";

const STORAGE_KEY = "colors-css";

/**
 * Keeps a copy of the person's colours in this browser, so the next page load
 * can apply them before first paint (see colorsScript) instead of flashing the
 * default colours while the page streams in.
 */
export function ColorsCache({ css }: { css: string }) {
  useEffect(() => {
    // The page's own copy has arrived, so the early one isn't needed (and may be out of date)
    document.getElementById("user-colors-early")?.remove();
    try {
      if (css) localStorage.setItem(STORAGE_KEY, css);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked: colours still arrive with the page, just a moment later
    }
  }, [css]);
  return null;
}

/** Runs in <head>: applies the saved colours if they're in the exact expected shape. */
export const colorsScript = `(function(){try{var c=localStorage.getItem("${STORAGE_KEY}");if(c&&${CUSTOM_COLORS_CSS}.test(c)){var s=document.createElement("style");s.id="user-colors-early";s.textContent=c;document.head.appendChild(s)}}catch(e){}})()`;
