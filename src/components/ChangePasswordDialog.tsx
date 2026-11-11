"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, X } from "lucide-react";
import { api, errorMessage } from "@/lib/store";

const MIN = 8;
const MAX = 72;

/** Centered pop-up to change the signed-in user's password (POST /api/auth/password). */
export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setShow(false);
      setError(null);
      setDone(false);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Close automatically shortly after a successful change.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [done, onClose]);

  const close = () => {
    if (!busy) onClose();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!current) return setError("Enter your current password.");
    if (next.length < MIN) return setError(`New password must be at least ${MIN} characters.`);
    if (next.length > MAX) return setError(`New password must be ${MAX} characters or fewer.`);
    if (next !== confirm) return setError("New passwords don't match.");
    if (next === current) return setError("New password must be different.");
    setBusy(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, "Could not change your password."));
    } finally {
      setBusy(false);
    }
  }

  const tooShort = next.length > 0 && next.length < MIN;
  const mismatch = confirm.length > 0 && confirm !== next;
  const inputCls =
    "w-full rounded-lg bg-surface-container-low px-4 py-3 outline-none ring-primary placeholder:text-outline focus-visible:ring-2";

  return (
    <dialog
      ref={ref}
      aria-labelledby="change-password-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc → our handler, so state stays in sync
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="m-auto w-[min(22rem,calc(100%-2rem))] rounded-2xl bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-scrim/40"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="change-password-title" className="text-lg font-semibold">
            Change password
          </h2>
          <button
            aria-label="Close"
            onClick={close}
            disabled={busy}
            className="-mr-1 rounded-full p-1.5 hover:bg-surface-container disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        {done ? (
          <div role="status" className="flex flex-col items-center py-6 text-center motion-safe:animate-[ledgerly-fade-up_0.3s_ease-out_both]">
            <CheckCircle2 className="size-12 text-primary motion-safe:animate-[ledgerly-pop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both]" aria-hidden />
            <p className="mt-3 text-lg font-semibold">Password changed</p>
            <p className="mt-1 text-sm text-on-surface-variant">Use your new password next time you log in.</p>
            <button onClick={onClose} className="mt-5 rounded-full bg-primary px-6 py-2.5 font-medium text-on-primary">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-3">
            <label className="block">
              <span className="label-caps mb-1 block text-on-surface-variant">Current password</span>
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                maxLength={MAX}
                className={inputCls}
                autoFocus
              />
            </label>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="new-password" className="label-caps text-on-surface-variant">
                  New password
                </label>
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide passwords" : "Show passwords"}
                  aria-pressed={show}
                  className="-my-1 rounded-full p-1 text-on-surface-variant hover:bg-surface-container"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                maxLength={MAX}
                aria-describedby="new-password-hint"
                className={inputCls}
              />
              <span id="new-password-hint" className={`mt-1 block px-1 text-xs ${tooShort ? "text-tertiary" : "text-on-surface-variant"}`}>
                At least {MIN} characters.
              </span>
            </div>
            <label className="block">
              <span className="label-caps mb-1 block text-on-surface-variant">Confirm new password</span>
              <input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                maxLength={MAX}
                className={inputCls}
              />
              {mismatch && <span className="mt-1 block px-1 text-xs text-tertiary">Passwords don&apos;t match yet.</span>}
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-full bg-surface-container py-2.5 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-primary py-2.5 font-medium text-on-primary disabled:opacity-60"
              >
                {busy ? "Saving…" : "Change"}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
