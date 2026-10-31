import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="card max-w-sm p-8">
        <SearchX className="mx-auto size-10 text-on-surface-variant" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-on-surface-variant">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
          Back to overview
        </Link>
      </div>
    </div>
  );
}
