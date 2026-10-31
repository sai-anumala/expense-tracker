import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { categories, categoryName, type Transaction } from "@/lib/data";
import { signedMoney, timeOf } from "@/lib/format";
import { IconTile } from "./ui";

export function TransactionRow({ t }: { t: Transaction }) {
  const cat = categories[t.category] ?? categories.other;
  const income = t.amount > 0;
  return (
    <li>
      <Link
        href={`/add?id=${t.id}`}
        aria-label={`Edit ${t.merchant}`}
        className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-4 transition hover:bg-surface-container-low"
      >
      <IconTile icon={cat.icon} tone={income ? "primary" : cat.tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold">{t.merchant}</p>
        <p className="truncate text-sm text-on-surface-variant">
          {categoryName(t)} <span aria-hidden>·</span> {timeOf(t.date)}
          {t.account && (
            <>
              {" "}
              <span aria-hidden>·</span> {t.account}
            </>
          )}
        </p>
      </div>
      <span className={`font-mono text-[17px] font-semibold ${income ? "text-primary" : "text-on-surface"}`}>
        {signedMoney(t.amount)}
      </span>
      <ChevronRight className="-ml-2 size-4 shrink-0 text-outline-variant group-hover:text-outline" aria-hidden />
      </Link>
    </li>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-on-surface-variant">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
