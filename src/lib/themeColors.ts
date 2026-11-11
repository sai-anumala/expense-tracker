/**
 * Plain hex copies of a few design tokens, for the only places that can't read CSS variables:
 * `viewport.themeColor` (browser chrome) and `global-error.tsx` (renders without globals.css).
 * Everything else uses the tokens in src/app/globals.css. Keep these in sync with them.
 */
export const themeColors = {
  surface: "#f7f9ff",
  onSurface: "#161c23",
  onSurfaceVariant: "#3d4a42",
  primary: "#006947",
  onPrimary: "#ffffff",
} as const;
