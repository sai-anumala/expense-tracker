"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, CreditCard, Inbox, Plus, ReceiptText, type LucideIcon } from "lucide-react";
import { useAppData } from "@/lib/store";
import { isNavActive, mainNav } from "./BottomNav";
import { Logo } from "./ui";

// There's room for the screens the phone's bottom bar has to leave out.
const moreNav = [
  { href: "/card", label: "Credit Card", icon: CreditCard },
  { href: "/transfer", label: "Transfer", icon: ArrowLeftRight },
  { href: "/transactions", label: "All Transactions", icon: ReceiptText },
];

function NavItem({ href, label, icon: Icon, badge }: { href: string; label: string; icon: LucideIcon; badge?: number }) {
  const active = isNavActive(usePathname(), href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] leading-tight transition xl:flex-row xl:gap-3 xl:px-3 xl:py-2.5 xl:text-left xl:text-sm ${
        active ? "bg-primary-fixed/50 font-semibold text-primary" : "text-on-surface-variant hover:bg-surface-container-low"
      }`}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="xl:flex-1">{label}</span>
      {badge !== undefined && (
        <span className="absolute top-1 right-2 grid h-4 min-w-4 place-items-center rounded-full bg-secondary px-1 text-[10px] font-bold tabular-nums text-white xl:static">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

/** Navigation from `md` up: an icon rail on tablets, a labelled sidebar from `xl`. Phones use BottomNav. */
export function SideNav() {
  const { captured } = useAppData();
  return (
    <aside className="fixed inset-y-0 left-[env(safe-area-inset-left)] z-30 hidden w-20 flex-col gap-4 overflow-y-auto border-r border-surface-container bg-surface-container-lowest px-2 py-4 md:flex xl:w-64 xl:px-4">
      <Link href="/" aria-label="Ledgerly, go to Overview" className="flex items-center justify-center gap-3 xl:justify-start xl:px-2">
        <Logo />
        <span className="hidden text-xl font-semibold tracking-tight xl:block">Ledgerly</span>
      </Link>
      <Link
        href="/add"
        aria-label="Add transaction"
        className="mx-auto grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-on-primary shadow-lg shadow-primary/30 transition hover:bg-primary-container xl:mx-0 xl:flex xl:h-12 xl:w-full xl:items-center xl:justify-center xl:gap-2 xl:font-semibold"
      >
        <Plus className="size-6" aria-hidden />
        <span className="hidden xl:inline">Add transaction</span>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {mainNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        <hr className="mx-2 my-2 border-surface-container" />
        {moreNav.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        {captured.length > 0 && <NavItem href="/review" label="To review" icon={Inbox} badge={captured.length} />}
      </nav>
    </aside>
  );
}
