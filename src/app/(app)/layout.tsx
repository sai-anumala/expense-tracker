import { TransactionsProvider } from "@/lib/store";

/** Signed-in area: loads the user's data before rendering any screen. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <TransactionsProvider>{children}</TransactionsProvider>;
}
