"use client";

import { useState } from "react";
import { Wallet, ReceiptText } from "lucide-react";
import { AppHeader, IconTile } from "@/components/ui";
import { TabPage } from "@/components/BottomNav";
import { EmptyState, TransactionRow } from "@/components/TransactionRow";
import { TransferRow } from "@/components/TransferRow";
import { useAppData } from "@/lib/store";
import { money } from "@/lib/format";
import { mergeFeed, transferAccountLabels } from "@/lib/transfers";

/** Net flow per payment method (transactions only), plus the full history including transfers. */
export default function Accounts() {
  const { transactions, transfers } = useAppData();
  const [filter, setFilter] = useState<string | null>(null);

  // Totals are transactions-only: transfers never count as income or spending.
  const totals = new Map<string, number>();
  for (const t of transactions) {
    const k = t.account || "Unspecified";
    totals.set(k, (totals.get(k) ?? 0) + t.amount);
  }
  const shownTx = filter ? transactions.filter((t) => (t.account || "Unspecified") === filter) : transactions;
  // With a method filter, show transfers touching the account of the same name (e.g. "UPI", "Cash", "Credit Card").
  const shownTr = filter
    ? transfers.filter((t) => transferAccountLabels[t.from] === filter || transferAccountLabels[t.to] === filter)
    : transfers;
  const shown = mergeFeed(shownTx, shownTr);

  return (
    <>
      <AppHeader subtitle="Accounts" />
      <TabPage>
        {transactions.length === 0 && transfers.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            body="Payment methods appear here once you record transactions with them."
          />
        ) : (
          <>
            {totals.size > 0 && <section>
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
            </section>}

            <section>
              <h2 className="mb-2 px-1 text-[22px] font-semibold tracking-tight">
                {filter ? `${filter} transactions` : "All transactions"}
              </h2>
              {shown.length === 0 ? (
                <EmptyState icon={ReceiptText} title="Nothing here" body="No transactions for this method." />
              ) : (
                <ul className="card divide-y divide-surface-container overflow-hidden px-5">
                  {shown.map((f) =>
                    f.kind === "transfer" ? (
                      <TransferRow key={`tr-${f.item.id}`} t={f.item} />
                    ) : (
                      <TransactionRow key={f.item.id} t={f.item} />
                    ),
                  )}
                </ul>
              )}
            </section>
          </>
        )}
      </TabPage>
    </>
  );
}
