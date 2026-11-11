import { themeColors } from "./themeColors";

/**
 * Light / dark theme. The choice is per device, in a cookie (the app keeps no state in localStorage,
 * see AGENTS.md §14), read before first paint by `themeInitScript` so there's no flash of the wrong theme.
 * Default is light. "system" follows the device setting and updates live when it changes.
 */
export const THEME_COOKIE = "ledgerly_theme";
export const THEME_PREFS = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEME_PREFS)[number];
export type Theme = "light" | "dark";
export const DEFAULT_THEME_PREF: ThemePref = "light";

export function parseThemePref(value: string | null | undefined): ThemePref {
  return (THEME_PREFS as readonly string[]).includes(value ?? "") ? (value as ThemePref) : DEFAULT_THEME_PREF;
}

/** The preference saved in a `document.cookie` string. */
export function themePrefFromCookie(cookie: string): ThemePref {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`));
  return parseThemePref(match?.[1]);
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): Theme {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

export function themeCookie(pref: ThemePref): string {
  return `${THEME_COOKIE}=${pref}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * Inline script for <head>. Sets `data-theme` (CSS), `data-theme-pref` (read back by the switcher),
 * the browser bar colour, and follows the device setting while the preference is "system".
 * Exposes `window.__ledgerlyTheme(pref)` so the switcher applies a change the same way.
 * Never throws: on any error the page simply stays light.
 */
export const themeInitScript = `(function(){try{
var d=document,r=d.documentElement,q=matchMedia("(prefers-color-scheme: dark)");
var m=d.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark|system)(?:;|$)/),p=m?m[1]:"${DEFAULT_THEME_PREF}";
function apply(){var t=p==="system"?(q.matches?"dark":"light"):p;r.dataset.theme=t;r.dataset.themePref=p;
var c=d.querySelector('meta[name="theme-color"]');if(!c){c=d.createElement("meta");c.name="theme-color";d.head.appendChild(c);}
c.content=t==="dark"?"${themeColors.surfaceDark}":"${themeColors.surface}";}
window.__ledgerlyTheme=function(n){p=n;apply();};
q.addEventListener("change",function(){if(p==="system")apply();});apply();
}catch(e){}})();`;
