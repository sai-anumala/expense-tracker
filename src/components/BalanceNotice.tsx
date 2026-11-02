import { Info, TriangleAlert } from "lucide-react";
import { moneySigned } from "@/lib/format";

/**
 * Non-blocking notice. "warn" (amber) = money going out exceeds the available balance;
 * "info" (neutral) = something worth knowing (e.g. budget above balance). Saving is still allowed.
 */
export function BalanceNotice({ tone = "warn", children }: { tone?: "warn" | "info"; children: React.ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${
        tone === "warn" ? "bg-tertiary-fixed text-on-surface" : "bg-surface-container-low text-on-surface-variant"
      }`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone === "warn" ? "text-tertiary" : "text-primary"}`} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Standard low-balance wording for money going out. */
export function ShortfallText({ available, after, verb }: { available: number; after: number; verb: string }) {
  return available > 0 ? (
    <>
      You only have <b className="tabular-nums">{moneySigned(available)}</b> available. {verb} takes your balance to{" "}
      <b className="tabular-nums">{moneySigned(after)}</b>. You can still save it.
    </>
  ) : (
    <>
      Your available balance is already <b className="tabular-nums">{moneySigned(available)}</b>. {verb} takes it to{" "}
      <b className="tabular-nums">{moneySigned(after)}</b>. You can still save it.
    </>
  );
}
