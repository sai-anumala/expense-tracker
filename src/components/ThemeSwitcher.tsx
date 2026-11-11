"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { parseThemePref, themeCookie, type ThemePref } from "@/lib/theme";

declare global {
  interface Window {
    __ledgerlyTheme?: (pref: ThemePref) => void;
  }
}

const options: { pref: ThemePref; label: string; icon: typeof Sun }[] = [
  { pref: "light", label: "Light", icon: Sun },
  { pref: "dark", label: "Dark", icon: Moon },
  { pref: "system", label: "Device", icon: Monitor },
];

/** Light / Dark / Device segmented control. Saves to this device only (cookie) and applies at once. */
export function ThemeSwitcher() {
  const [pref, setPref] = useState<ThemePref>("light");
  // The head script already applied the saved choice; read it back once on mount.
  useEffect(() => setPref(parseThemePref(document.documentElement.dataset.themePref)), []);

  function choose(next: ThemePref) {
    setPref(next);
    document.cookie = themeCookie(next);
    window.__ledgerlyTheme?.(next);
  }

  return (
    <div className="px-4 py-3">
      <p id="theme-label" className="label-caps mb-2 text-on-surface-variant">
        Appearance
      </p>
      <div role="radiogroup" aria-labelledby="theme-label" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-container-low p-1">
        {options.map(({ pref: value, label, icon: Icon }) => {
          const active = pref === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(value)}
              className={`flex flex-col items-center gap-1 rounded-md py-2 text-xs font-medium transition ${
                active
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
