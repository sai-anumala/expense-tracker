"use client";

import Link from "next/link";
import { Landmark, Wallet, IndianRupee, ArrowLeftRight, Banknote, CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";

const upcoming = [
  { icon: ArrowLeftRight, title: "Bank ↔ wallet / UPI", body: "Move money between your own accounts in one tap." },
  { icon: Banknote, title: "ATM cash withdrawals", body: "Bank to cash, tracked so your cash in hand is always right." },
  { icon: CreditCard, title: "Credit card bill payments", body: "Pay off a card without counting it as spending twice." },
  { icon: ShieldCheck, title: "Never counted as spending", body: "Transfers keep your budget and analytics honest." },
];

/** "Coming soon" placeholder for transfers between the user's own accounts. Animations respect reduce-motion. */
export default function Transfer() {
  return (
    <>
      <AppHeader subtitle="Transfer" />
      <TabPage>
        {/* Hero */}
        <section className="relative overflow-hidden rounded-xl bg-surface-container-lowest px-5 pt-6 pb-7 text-center shadow-sm">
          <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/15 blur-2xl motion-safe:animate-pulse" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 size-36 rounded-full bg-primary-fixed/30 blur-2xl" />

          <span
            className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-primary motion-safe:animate-[ledgerly-shimmer_3s_linear_infinite]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--color-primary-fixed) 0%, #ffffff 50%, var(--color-primary-fixed) 100%)",
              backgroundSize: "200% 100%",
            }}
          >
            <Sparkles className="size-3.5" aria-hidden /> Coming soon
          </span>

          {/* Illustration: coins travelling from bank to wallet */}
          <div className="relative mx-auto mt-6 h-24 max-w-72" aria-hidden>
            <svg className="absolute inset-x-12 top-1/2 h-2 -translate-y-1/2" viewBox="0 0 100 2" preserveAspectRatio="none">
              <line
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="var(--color-outline-variant)"
                strokeWidth="2"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                className="motion-safe:animate-[ledgerly-dash_0.8s_linear_infinite]"
              />
            </svg>
            <div className="absolute top-1/2 left-0 -translate-y-1/2">
              <span className="relative grid size-16 place-items-center rounded-2xl bg-primary text-on-primary shadow-lg shadow-primary/30 motion-safe:animate-[ledgerly-float_3s_ease-in-out_infinite]">
                <Landmark className="size-7" />
              </span>
            </div>
            <div className="absolute top-1/2 right-0 -translate-y-1/2">
              <span
                className="relative grid size-16 place-items-center rounded-2xl bg-primary-container text-on-primary shadow-lg shadow-primary/30 motion-safe:animate-[ledgerly-float_3s_ease-in-out_infinite]"
                style={{ animationDelay: "1.5s" }}
              >
                <Wallet className="size-7" />
                <span className="absolute -top-1 -right-1 size-3 rounded-full bg-primary-fixed motion-safe:animate-ping" />
              </span>
            </div>
            {[0, 0.8, 1.6].map((delay) => (
              <span
                key={delay}
                className="absolute top-1/2 left-[8%] grid size-7 place-items-center rounded-full bg-[#eda100] text-white opacity-0 shadow-md motion-safe:animate-[ledgerly-travel_2.4s_ease-in-out_infinite] motion-reduce:hidden"
                style={{ animationDelay: `${delay}s` }}
              >
                <IndianRupee className="size-4" strokeWidth={2.5} />
              </span>
            ))}
          </div>

          <h1 className="relative mt-6 text-[26px] leading-8 font-semibold tracking-tight">Move money between your accounts</h1>
          <p className="relative mx-auto mt-2 max-w-xs text-sm text-on-surface-variant">
            Transfers will let you shift money between bank, UPI, wallet and cash without it showing up as spending.
          </p>
        </section>

        {/* What's coming */}
        <section>
          <h2 className="label-caps mb-3 px-1 text-on-surface-variant">What&apos;s coming</h2>
          <ul className="space-y-2">
            {upcoming.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="card flex items-start gap-3 p-4 motion-safe:animate-[ledgerly-fade-up_0.5s_ease-out_both]"
                style={{ animationDelay: `${150 + i * 120}ms` }}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-fixed/50 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-on-surface-variant">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div
          className="space-y-2 text-center motion-safe:animate-[ledgerly-fade-up_0.5s_ease-out_both]"
          style={{ animationDelay: "700ms" }}
        >
          <p className="text-sm text-on-surface-variant">
            Until then, money lent or borrowed goes in <Link href="/loans" className="font-medium text-primary">Loans</Link>.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-on-primary shadow-lg shadow-primary/25"
          >
            Back to Overview
          </Link>
        </div>
      </TabPage>
    </>
  );
}
