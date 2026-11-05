import { SideNav } from "@/components/SideNav";
import { TransactionsProvider } from "@/lib/store";

/** Signed-in area: loads the user's data before rendering any screen. Side navigation from `md`, bottom bar below it. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TransactionsProvider>
      <SideNav />
      <div className="md:pl-20 xl:pl-64">
        <div className="mx-auto w-full max-w-6xl min-[1920px]:max-w-[96rem]">{children}</div>
      </div>
    </TransactionsProvider>
  );
}
