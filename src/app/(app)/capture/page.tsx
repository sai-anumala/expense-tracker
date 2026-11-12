"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { BalanceNotice } from "@/components/BalanceNotice";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SubHeader } from "@/components/ui";
import { buildGmailScript } from "@/lib/gmailScript";
import { errorMessage, useAppData, type CaptureStatus } from "@/lib/store";

const formatWhen = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function CapturePage() {
  const { getCaptureStatus, createCaptureToken, revokeCaptureToken } = useAppData();
  const [status, setStatus] = useState<CaptureStatus | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<"regenerate" | "revoke" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLocal(/^(localhost|127\.|\[::1\])/.test(window.location.hostname));
    getCaptureStatus()
      .then(setStatus)
      .catch((e) => setError(errorMessage(e, "Could not load auto-capture settings.")));
  }, [getCaptureStatus]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const token = await createCaptureToken();
      setScript(buildGmailScript(window.location.origin, token));
      setStatus(await getCaptureStatus());
      setCopied(false);
    } catch (e) {
      setError(errorMessage(e, "Could not create the script."));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await revokeCaptureToken();
      setScript(null);
      setStatus({ exists: false, createdAt: null, lastUsedAt: null });
    } catch (e) {
      setError(errorMessage(e, "Could not turn off auto-capture."));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function copy() {
    if (!script) return;
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
    } catch {
      setError("Couldn't copy automatically. Select the script below and copy it.");
    }
  }

  return (
    <div className="pb-10">
      <SubHeader title="Gmail auto-capture" backHref="/" />

      <main className="mx-auto w-full max-w-2xl space-y-4 px-5 pt-2 md:px-0">
        <section className="card space-y-3 p-5">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-fixed/50">
            <Mail className="size-5 text-primary" aria-hidden />
          </span>
          <p className="text-sm text-on-surface-variant">
            A small script in your own Google account sends your bank&apos;s alert emails to your{" "}
            <Link href="/review" className="font-medium text-primary underline underline-offset-2">
              To review
            </Link>{" "}
            list every few minutes. Nothing counts in your totals until you add it.
          </p>

          {status?.exists && (
            <p className="text-sm">
              <b className="font-semibold">Status:</b>{" "}
              {status.lastUsedAt ? `last alert received ${formatWhen(status.lastUsedAt)}` : "script created, no alerts received yet"}
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-secondary-fixed px-4 py-3 text-sm text-secondary">
              {error}
            </p>
          )}

          {isLocal && (
            <BalanceNotice>
              You&apos;re on a local address, which Google can&apos;t reach. Create the script from the live site to use it.
            </BalanceNotice>
          )}

          {status && !status.exists && (
            <button onClick={generate} disabled={busy} className="rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary disabled:opacity-50">
              {busy ? "Creating…" : "Create my script"}
            </button>
          )}
          {status?.exists && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirm("regenerate")}
                disabled={busy}
                className="rounded-full bg-surface-container px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Create a new script
              </button>
              <button
                onClick={() => setConfirm("revoke")}
                disabled={busy}
                className="rounded-full px-4 py-2 text-sm font-medium text-secondary hover:bg-secondary-fixed/50 disabled:opacity-50"
              >
                Turn off
              </button>
            </div>
          )}
        </section>

        {script && (
          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-semibold">Your script</h2>
            <BalanceNotice>Copy it now. This private script is only shown once.</BalanceNotice>
            <button onClick={copy} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-on-primary">
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy script"}
            </button>
            <textarea
              readOnly
              aria-label="Your Gmail script"
              value={script}
              rows={8}
              className="w-full rounded-lg bg-surface-container-low p-3 font-mono text-xs outline-none"
            />
          </section>
        )}

        <section className="card space-y-3 p-5">
          <h2 className="text-lg font-semibold">Set it up</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-on-surface-variant">
            <li>On a computer, create your script above and copy it.</li>
            <li>
              Open{" "}
              <a href="https://script.google.com" target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
                script.google.com
              </a>{" "}
              with the Google account that gets your bank alerts, choose New project, and replace everything with the script.
            </li>
            <li>Check BANK_SENDERS: HDFC&apos;s alert address is filled in. For another bank, add or replace it with the address its alerts come from (find it on any alert in Gmail).</li>
            <li>Save, choose the setup function at the top, and press Run.</li>
            <li>Approve access. Google may warn that the app isn&apos;t verified, because it&apos;s your own script: choose Advanced, then continue.</li>
            <li>
              Check the trigger: in the left sidebar, click <span className="font-medium text-on-surface">Triggers</span> (the clock icon). You should see{" "}
              <span className="font-mono text-xs">sendBankAlerts</span>, Time-based, every 5 minutes. If it isn&apos;t there, add it:
              <ol className="mt-2 list-[lower-alpha] space-y-1 pl-5">
                <li>Click <span className="font-medium text-on-surface">+ Add Trigger</span> (bottom right).</li>
                <li>Function to run: <span className="font-mono text-xs">sendBankAlerts</span>. Deployment: Head.</li>
                <li>Event source: Time-driven. Type: Minutes timer. Interval: Every 5 minutes.</li>
                <li>Click Save and approve access if asked.</li>
              </ol>
            </li>
            <li>Keep just one <span className="font-mono text-xs">sendBankAlerts</span> trigger. If you see two, delete one (⋮ → Delete trigger).</li>
          </ol>
          <p className="text-sm text-on-surface-variant">Only alerts arriving after setup are sent. Your next bank alert should appear within a few minutes.</p>
        </section>

        <section className="card space-y-2 p-5 text-sm text-on-surface-variant">
          <h2 className="text-lg font-semibold text-on-surface">Your privacy</h2>
          <p>The script only sends emails from the addresses you list. It runs in your Google account, and no other service receives your alerts.</p>
          <p>
            Ledgerly drops OTPs, adverts, reminders and failed payments without saving them. Other alerts are saved with account numbers and balances
            hidden, and are deleted once you add or remove them, or after 30 days.
          </p>
        </section>

        <ConfirmDialog
          open={confirm === "regenerate"}
          title="Create a new script?"
          message="Your current script will stop working. You'll need to replace it in script.google.com."
          confirmLabel="Yes, create"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={generate}
        />
        <ConfirmDialog
          open={confirm === "revoke"}
          title="Turn off auto-capture?"
          message="Your script will stop working. Alerts already in your To review list stay there. You can also delete the project in script.google.com."
          confirmLabel="Yes, turn off"
          danger
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={revoke}
        />
      </main>
    </div>
  );
}
