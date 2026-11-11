/**
 * Plain hex copies of a few design tokens, for the only places that can't read CSS variables:
 * the browser bar colour (`<meta name="theme-color">`, set by the theme script) and `global-error.tsx`
 * (renders without globals.css). Everything else uses the tokens in src/app/globals.css. Keep in sync.
 */
export const themeColors = {
  surface: "#f7f9ff",
  surfaceDark: "#0f1419",
  onSurface: "#161c23",
  onSurfaceVariant: "#3d4a42",
  primary: "#006947",
  onPrimary: "#ffffff",
} as const;
