"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ChartSpline, PieChart, HandCoins, Plus } from "lucide-react";

const left = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/analytics", label: "Analytics", icon: ChartSpline },
];
const right = [
  { href: "/budgets", label: "Budgets", icon: PieChart },
  { href: "/loans", label: "Loans", icon: HandCoins },
];

/** The main tabs, in order (bottom bar on phones, SideNav from `md`). */
export const mainNav = [...left, ...right];

export const isNavActive = (path: string, href: string) =>
  href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);

/** Phones only; from `md` up SideNav takes over. */
export function BottomNav() {
  const path = usePathname();
  const item = ({ href, label, icon: Icon }: (typeof left)[number]) => {
    const active = isNavActive(path, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-xs max-[320px]:text-[10px] ${
          active ? "font-semibold text-primary" : "text-on-surface-variant"
        }`}
      >
        <Icon className="size-6" aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-container bg-surface-container-lowest/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center">
        {left.map(item)}
        <Link
          href="/add"
          aria-label="Add expense"
          className="mx-2 grid size-14 shrink-0 -translate-y-2 place-items-center max-[320px]:mx-1 max-[320px]:size-12 rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/30 transition hover:bg-primary-container"
        >
          <Plus className="size-7" />
        </Link>
        {right.map(item)}
      </div>
    </nav>
  );
}

/** Page shell for the tabbed screens: content padded above the bottom bar on phones. */
export function TabPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="space-y-6 px-5 pt-2 pb-32 md:px-8 md:pb-10">{children}</main>
      <BottomNav />
    </>
  );
}
