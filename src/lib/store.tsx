"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DatabaseZap, RotateCw } from "lucide-react";
import { Splash } from "@/components/Splash";
import { emptyBudget, emptySettings, type Budget, type Settings, type Transaction } from "./data";
import type { Loan } from "./loans";

type NewTransaction = Omit<Transaction, "id"> & { receiptName?: string };
export type LoanInput = Omit<Loan, "id" | "payments">;
export type PaymentInput = { amount: number; date: string; account?: string; note?: string };

export type User = { id: string; name: string; email: string };

type Ctx = {
  user: User;
  logout: () => Promise<void>;
  /** All transactions from MongoDB, newest first. */
  transactions: Transaction[];
  add: (t: NewTransaction) => Promise<void>;
  update: (id: string, t: NewTransaction) => Promise<void>;
  remove: (id: string) => Promise<void>;
  budget: Budget;
  saveBudget: (b: Budget) => Promise<void>;
  settings: Settings;
  /** Saves the balance; the server stamps balanceAsOf = now. */
  saveSettings: (s: Pick<Settings, "openingBalance">) => Promise<void>;
  /** Money lent/borrowed. Affects Total Available Balance, never income/spending. */
  loans: Loan[];
  addLoan: (l: LoanInput) => Promise<Loan>;
  updateLoan: (id: string, l: LoanInput) => Promise<void>;
  removeLoan: (id: string) => Promise<void>;
  addPayment: (loanId: string, p: PaymentInput) => Promise<void>;
  removePayment: (loanId: string, paymentId: string) => Promise<void>;
};

const AppDataContext = createContext<Ctx | null>(null);

/** Error from an API call; `status` is the HTTP status (0 = network/timeout). */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TIMEOUT_MS = 15_000;

function fallbackMessage(status: number) {
  if (status === 404) return "Not found.";
  if (status === 408 || status === 504) return "The server took too long to respond. Please try again.";
  if (status === 503) return "The service is temporarily unavailable. Please try again shortly.";
  if (status >= 500) return "Something went wrong on the server. Please try again.";
  if (status >= 400) return "The request was rejected. Please check your input.";
  return "Unexpected response from the server.";
}

/** fetch wrapper: JSON in/out, timeout, and readable errors for every failure mode. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      ...init,
      signal: controller.signal,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError")
      throw new ApiError("The server took too long to respond. Please try again.", 0);
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    throw new ApiError(
      offline ? "You're offline. Check your internet connection and try again." : "Can't reach the server. Is it running?",
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  // Session expired or missing: go to the login page and come back here afterwards.
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    const here = window.location.pathname + window.location.search;
    window.location.assign(`/login${here && here !== "/" ? `?next=${encodeURIComponent(here)}` : ""}`);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ApiError(typeof json?.error === "string" ? json.error : fallbackMessage(res.status), res.status);
  }
  return json.payload as T;
}

export const errorMessage = (e: unknown, fallback = "Something went wrong. Please try again.") =>
  e instanceof Error && e.message ? e.message : fallback;

const byDateDesc = (a: Transaction, b: Transaction) => +new Date(b.date) - +new Date(a.date);

/** All app data is read from and written to MongoDB via the API routes. */
export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<Budget>(emptyBudget);
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Keep the launch splash up for a short minimum so its animation can finish (only on app open;
  // the (app) layout persists across tab navigation, so this doesn't replay).
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 800);
    return () => clearTimeout(t);
  }, []);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [me, tx, b, s, ln] = await Promise.all([
        api<User>("/api/auth/me"),
        api<Transaction[]>("/api/transactions"),
        api<Budget>("/api/budget"),
        api<Settings>("/api/settings"),
        api<Loan[]>("/api/loans"),
      ]);
      setUser(me);
      setTransactions(tx.sort(byDateDesc));
      setBudget(b);
      setSettings(s);
      setLoans(ln);
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return; // redirecting to /login; keep the spinner
      setError(errorMessage(e, "Could not load your data."));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    // Remove data left by the earlier localStorage-based version of the app.
    try {
      localStorage.removeItem("ledgerly.transactions.v1");
    } catch {
      /* ignore */
    }
    load();
  }, [load]);

  const add = useCallback(async (t: NewTransaction) => {
    const saved = await api<Transaction>("/api/transactions", { method: "POST", body: JSON.stringify(t) });
    setTransactions((prev) => [saved, ...prev].sort(byDateDesc));
  }, []);

  // If the server says the transaction is gone, drop it locally so the list isn't stale.
  const dropIfGone = useCallback((id: string, e: unknown) => {
    if (e instanceof ApiError && e.status === 404) setTransactions((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const update = useCallback(
    async (id: string, t: NewTransaction) => {
      try {
        const saved = await api<Transaction>(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(t) });
        setTransactions((prev) => prev.map((x) => (x.id === id ? saved : x)).sort(byDateDesc));
      } catch (e) {
        dropIfGone(id, e);
        throw e;
      }
    },
    [dropIfGone],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await api(`/api/transactions/${id}`, { method: "DELETE" });
        setTransactions((prev) => prev.filter((x) => x.id !== id));
      } catch (e) {
        // Already deleted elsewhere: that's the outcome the user wanted.
        if (e instanceof ApiError && e.status === 404) {
          dropIfGone(id, e);
          return;
        }
        throw e;
      }
    },
    [dropIfGone],
  );

  const saveBudget = useCallback(async (b: Budget) => {
    setBudget(await api<Budget>("/api/budget", { method: "PUT", body: JSON.stringify(b) }));
  }, []);

  const saveSettings = useCallback(async (s: Pick<Settings, "openingBalance">) => {
    setSettings(await api<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(s) }));
  }, []);

  // ── Loans ──
  const replaceLoan = (saved: Loan) => setLoans((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
  const dropLoanIfGone = (id: string, e: unknown) => {
    if (e instanceof ApiError && e.status === 404) setLoans((prev) => prev.filter((x) => x.id !== id));
  };

  const addLoan = useCallback(async (l: LoanInput) => {
    const saved = await api<Loan>("/api/loans", { method: "POST", body: JSON.stringify(l) });
    setLoans((prev) => [saved, ...prev]);
    return saved;
  }, []);

  const updateLoan = useCallback(async (id: string, l: LoanInput) => {
    try {
      replaceLoan(await api<Loan>(`/api/loans/${id}`, { method: "PUT", body: JSON.stringify(l) }));
    } catch (e) {
      dropLoanIfGone(id, e);
      throw e;
    }
  }, []);

  const removeLoan = useCallback(async (id: string) => {
    try {
      await api(`/api/loans/${id}`, { method: "DELETE" });
      setLoans((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return dropLoanIfGone(id, e);
      throw e;
    }
  }, []);

  const addPayment = useCallback(async (loanId: string, p: PaymentInput) => {
    try {
      replaceLoan(await api<Loan>(`/api/loans/${loanId}/payments`, { method: "POST", body: JSON.stringify(p) }));
    } catch (e) {
      dropLoanIfGone(loanId, e);
      throw e;
    }
  }, []);

  const removePayment = useCallback(async (loanId: string, paymentId: string) => {
    replaceLoan(await api<Loan>(`/api/loans/${loanId}/payments/${paymentId}`, { method: "DELETE" }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      // Full reload clears all in-memory data from the previous user.
      window.location.assign("/login");
    }
  }, []);

  if (status === "loading" || (status === "ready" && !user) || (status === "ready" && !introDone)) {
    return <Splash />;
  }

  if (status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
        <div className="card max-w-sm p-8">
          <DatabaseZap className="mx-auto size-10 text-secondary" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold">Couldn&apos;t load your data</h1>
          <p role="alert" className="mt-2 text-sm text-on-surface-variant">
            {error}
          </p>
          <button
            onClick={load}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary"
          >
            <RotateCw className="size-4" aria-hidden /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppDataContext.Provider
      value={{
        user: user!,
        logout,
        transactions,
        add,
        update,
        remove,
        budget,
        saveBudget,
        settings,
        saveSettings,
        loans,
        addLoan,
        updateLoan,
        removeLoan,
        addPayment,
        removePayment,
      }}
    >
      <div className="motion-safe:animate-[ledgerly-fade-in_0.4s_ease-out_both]">{children}</div>
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside TransactionsProvider");
  return ctx;
}
