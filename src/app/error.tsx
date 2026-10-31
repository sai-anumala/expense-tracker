"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert, RotateCw } from "lucide-react";

/** Error boundary for any page: shown instead of a blank/crashed screen. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="card max-w-sm p-8">
        <TriangleAlert className="mx-auto size-10 text-tertiary" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          This screen hit an unexpected error. Your saved data is safe.
        </p>
        {error.digest && <p className="mt-2 font-mono text-xs text-outline">Ref: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary"
          >
            <RotateCw className="size-4" aria-hidden /> Try again
          </button>
          <Link href="/" className="rounded-full bg-surface-container px-5 py-2.5 font-medium">
            Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
