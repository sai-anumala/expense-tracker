import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous / Page N of M / Next. Renders nothing when everything fits on one page. */
export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  const button =
    "flex items-center gap-1 rounded-full bg-surface-container-low px-4 py-2.5 text-sm font-medium transition hover:bg-surface-container disabled:opacity-40 disabled:hover:bg-surface-container-low";
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
      <button type="button" className={button} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="size-4" aria-hidden /> <span className="max-[340px]:sr-only">Previous</span>
      </button>
      <span className="text-sm tabular-nums whitespace-nowrap text-on-surface-variant" aria-current="page">
        Page {page} of {pages}
      </span>
      <button type="button" className={button} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <span className="max-[340px]:sr-only">Next</span> <ChevronRight className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
