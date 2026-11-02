import { Wallet } from "lucide-react";

/**
 * Launch splash shown while the signed-in app loads its data (see TransactionsProvider).
 * Logo pops in with a soft ring pulse, name + tagline slide up, a thin progress line glides.
 * Every animation is motion-safe: with "reduce motion" it renders as a static logo.
 */
export function Splash() {
  return (
    <div
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Soft background glow */}
      <div className="pointer-events-none absolute top-1/3 left-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl motion-safe:animate-[ledgerly-fade-in_0.8s_ease-out_both]" />
      <div className="pointer-events-none absolute right-[-4rem] bottom-[-4rem] size-56 rounded-full bg-primary-fixed/25 blur-3xl motion-safe:animate-[ledgerly-fade-in_1.2s_ease-out_both]" />

      <div className="relative flex flex-col items-center">
        <div className="relative">
          {/* One soft ring pulse after the logo lands */}
          <span
            className="absolute inset-0 rounded-[1.75rem] bg-primary opacity-0 motion-safe:animate-[ledgerly-ring_1s_ease-out_0.45s_both]"
            aria-hidden
          />
          <span className="relative grid size-20 place-items-center rounded-[1.75rem] bg-primary text-on-primary shadow-xl shadow-primary/30 motion-safe:animate-[ledgerly-pop_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]">
            <Wallet className="size-10" strokeWidth={1.75} aria-hidden />
          </span>
        </div>

        <p
          className="mt-6 text-[32px] leading-none font-bold tracking-tight motion-safe:animate-[ledgerly-fade-up_0.5s_ease-out_0.25s_both]"
        >
          Ledgerly
        </p>
        <p className="mt-2 text-sm text-on-surface-variant motion-safe:animate-[ledgerly-fade-up_0.5s_ease-out_0.4s_both]">
          Track every rupee, calmly.
        </p>

        {/* Thin indeterminate progress line */}
        <div
          className="mt-8 h-1 w-28 overflow-hidden rounded-full bg-surface-container-high motion-safe:animate-[ledgerly-fade-in_0.4s_ease-out_0.5s_both]"
          aria-hidden
        >
          <div className="h-full w-1/2 rounded-full bg-primary motion-safe:animate-[ledgerly-progress_1.1s_ease-in-out_infinite]" />
        </div>
        <span className="sr-only">Loading your data…</span>
      </div>
    </div>
  );
}
