"use client";

import { useState } from "react";
import { Wallet, ReceiptText } from "lucide-react";
import { AppHeader, IconTile } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { EmptyState, TransactionRow } from "@/components/TransactionRow";
import { useAppData } from "@/lib/store";
import { money } from "@/lib/format";

/** Net flow per payment method, plus the full transaction history. */
export default function Accounts() {
  const { transactions } = useAppData();
  const [filter, setFilter] = useState<string | null>(null);

  const totals = new Map<string, number>();
  for (const t of transactions) {
    const k = t.account || "Unspecified";
    totals.set(k, (totals.get(k) ?? 0) + t.amount);
  }
  const shown = filter ? transactions.filter((t) => (t.account || "Unspecified") === filter) : transactions;

  return (
    <>
      <AppHeader subtitle="Accounts" />
      <TabPage>
        {transactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            body="Payment methods appear here once you record transactions with them."
          />
        ) : (
          <>
            <section>
              <h2 className="label-caps mb-3 px-1 text-on-surface-variant">By payment method</h2>
              <ul className="card divide-y divide-surface-container px-5">
                {[...totals].map(([name, amount]) => (
                  <li key={name}>
                    <button
                      onClick={() => setFilter(filter === name ? null : name)}
                      aria-pressed={filter === name}
                      className="flex w-full items-center gap-4 py-4 text-left"
                    >
                      <IconTile icon={Wallet} tone={filter === name ? "primary" : "neutral"} />
                      <span className="flex-1 font-semibold">{name}</span>
                      <span className={`tabular-nums font-semibold ${amount < 0 ? "text-secondary" : "text-primary"}`}>
                        {amount < 0 ? "-" : "+"}
                        {money(amount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 px-1 text-[22px] font-semibold tracking-tight">
                {filter ? `${filter} transactions` : "All transactions"}
              </h2>
              {shown.length === 0 ? (
                <EmptyState icon={ReceiptText} title="Nothing here" body="No transactions for this method." />
              ) : (
                <ul className="card divide-y divide-surface-container overflow-hidden px-5">
                  {shown.map((t) => (
                    <TransactionRow key={t.id} t={t} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </TabPage>
    </>
  );
}
