"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Mail, LockKeyhole, UserRound } from "lucide-react";
import { Logo } from "./ui";
import { api, errorMessage } from "@/lib/store";

type Mode = "login" | "signup";

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/login") && !raw.startsWith("/signup")
    ? raw
    : "/";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const isSignup = mode === "signup";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwTooShort = isSignup && password.length > 0 && password.length < 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (isSignup && !name.trim()) return setError("Enter your name.");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    if (isSignup && password.length < 8) return setError("Password must be at least 8 characters.");

    setBusy(true);
    try {
      await api(isSignup ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
      });
      // Full navigation so the app loads fresh with the new session.
      window.location.assign(next);
    } catch (err) {
      setError(errorMessage(err, isSignup ? "Could not create your account." : "Could not sign you in."));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="motion-safe:animate-[ledgerly-pop_0.6s_cubic-bezier(0.34,1.56,0.64,1)_both]">
          <Logo />
        </span>
        <h1 className="mt-4 text-[28px] leading-9 font-semibold tracking-tight motion-safe:animate-[ledgerly-fade-up_0.5s_ease-out_0.15s_both]">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-on-surface-variant motion-safe:animate-[ledgerly-fade-up_0.5s_ease-out_0.25s_both]">
          {isSignup ? "Track spending, budgets and balances in one place." : "Log in to your Ledgerly account."}
        </p>
      </div>

      <form
        onSubmit={submit}
        noValidate
        className="card relative space-y-3 overflow-hidden p-5 motion-safe:animate-[ledgerly-fade-up_0.55s_ease-out_0.35s_both]"
      >
        <div className="pointer-events-none absolute -top-8 -right-8 size-32 rounded-full bg-primary/10 blur-2xl" />

        {isSignup && (
          <Field icon={UserRound} label="Name">
            <input
              autoComplete="name"
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
            />
          </Field>
        )}
        <Field icon={Mail} label="Email">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus={!isSignup}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
          />
        </Field>
        <Field
          icon={LockKeyhole}
          label="Password"
          trailing={
            <button
              type="button"
              aria-label={showPw ? "Hide password" : "Show password"}
              onClick={() => setShowPw((s) => !s)}
              className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
            >
              {showPw ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          }
        >
          <input
            type={showPw ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            maxLength={72}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "At least 8 characters" : "Your password"}
            aria-invalid={pwTooShort}
            className="w-full bg-transparent text-lg outline-none placeholder:text-outline"
          />
        </Field>
        {pwTooShort && <p className="px-1 text-sm text-tertiary">Use at least 8 characters.</p>}

        {error && (
          <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="relative w-full rounded-xl bg-primary py-4 text-lg font-semibold text-on-primary shadow-lg shadow-primary/25 transition hover:bg-primary-container disabled:opacity-60"
        >
          {busy ? (isSignup ? "Creating account…" : "Logging in…") : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-on-surface-variant motion-safe:animate-[ledgerly-fade-in_0.5s_ease-out_0.55s_both]">
        {isSignup ? "Already have an account? " : "New to Ledgerly? "}
        <Link
          href={`${isSignup ? "/login" : "/signup"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-primary"
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}

function Field({
  icon: Icon,
  label,
  trailing,
  children,
}: {
  icon: typeof Mail;
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex items-center gap-4 rounded-lg bg-surface-container-low px-4 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-container-lowest">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="label-caps block text-on-surface-variant">{label}</span>
        {children}
      </span>
      {trailing}
    </label>
  );
}
