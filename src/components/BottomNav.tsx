"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ChartSpline, PieChart, Wallet, Plus } from "lucide-react";

const left = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/analytics", label: "Analytics", icon: ChartSpline },
];
const right = [
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/accounts", label: "Accounts", icon: Wallet },
];

export function BottomNav() {
  const path = usePathname();
  const item = ({ href, label, icon: Icon }: (typeof left)[number]) => {
    const active = path === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${
          active ? "font-semibold text-primary" : "text-on-surface-variant"
        }`}
      >
        <Icon className="size-6" aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-surface-container bg-surface-container-lowest/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="flex items-center">
        {left.map(item)}
        <Link
          href="/add"
          aria-label="Add expense"
          className="mx-2 grid size-14 -translate-y-2 place-items-center rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/30 transition hover:bg-primary-container"
        >
          <Plus className="size-7" />
        </Link>
        {right.map(item)}
      </div>
    </nav>
  );
}

/** Page shell for the tabbed screens: content padded above the fixed nav. */
export function TabPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="space-y-6 px-5 pt-2 pb-32">{children}</main>
      <BottomNav />
    </>
  );
}
