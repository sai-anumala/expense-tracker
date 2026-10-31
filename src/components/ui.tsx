import Link from "next/link";
import { UserMenu } from "./UserMenu";
import { Bell, CalendarDays, ChevronDown, Wallet, type LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/data";

const toneClasses: Record<Tone | "secondary", string> = {
  neutral: "bg-surface-container-high text-on-surface",
  primary: "bg-primary-fixed/50 text-primary",
  tertiary: "bg-tertiary-fixed text-tertiary",
  secondary: "bg-secondary-fixed text-secondary",
};

export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "md",
  round = false,
}: {
  icon: LucideIcon;
  tone?: Tone | "secondary";
  size?: "sm" | "md";
  round?: boolean;
}) {
  const dims = size === "md" ? "size-12" : "size-10";
  return (
    <span
      className={`${dims} ${round ? "rounded-full" : "rounded-lg"} ${toneClasses[tone]} grid shrink-0 place-items-center`}
    >
      <Icon className="size-5" strokeWidth={2} aria-hidden />
    </span>
  );
}

export function Logo() {
  return (
    <span className="grid size-9 place-items-center rounded-lg bg-primary text-on-primary">
      <Wallet className="size-5" aria-hidden />
    </span>
  );
}

export function AppHeader({ subtitle }: { subtitle: string }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-surface-container-lowest/90 px-5 py-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-3">
        <Logo />
        <span className="leading-tight">
          <span className="block text-xl font-semibold tracking-tight">Ledgerly</span>
          <span className="block text-sm text-on-surface-variant">{subtitle}</span>
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <button aria-label="Notifications" className="rounded-full p-2 hover:bg-surface-container">
          <Bell className="size-5" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

export function MonthPill({ label }: { label: string }) {
  return (
    <button className="flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 font-semibold">
      <CalendarDays className="size-4 text-primary" aria-hidden />
      {label}
      <ChevronDown className="size-4" aria-hidden />
    </button>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
}: {
  value: number; // 0..1
  tone?: "primary" | "tertiary";
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${tone === "primary" ? "bg-primary" : "bg-tertiary-container"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SectionTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[22px] leading-7 font-semibold tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-on-surface-variant">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
