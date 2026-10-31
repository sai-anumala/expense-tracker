"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DatabaseZap, RotateCw } from "lucide-react";
import { emptyBudget, emptySettings, type Budget, type Settings, type Transaction } from "./data";

type NewTransaction = Omit<Transaction, "id"> & { receiptName?: string };

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
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [me, tx, b, s] = await Promise.all([
        api<User>("/api/auth/me"),
        api<Transaction[]>("/api/transactions"),
        api<Budget>("/api/budget"),
        api<Settings>("/api/settings"),
      ]);
      setUser(me);
      setTransactions(tx.sort(byDateDesc));
      setBudget(b);
      setSettings(s);
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

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      // Full reload clears all in-memory data from the previous user.
      window.location.assign("/login");
    }
  }, []);

  if (status === "loading" || (status === "ready" && !user)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface" aria-busy="true" aria-live="polite">
        <span className="size-8 animate-spin rounded-full border-2 border-surface-container-high border-t-primary" />
        <span className="sr-only">Loading your data…</span>
      </div>
    );
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
      value={{ user: user!, logout, transactions, add, update, remove, budget, saveBudget, settings, saveSettings }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used inside TransactionsProvider");
  return ctx;
}
