"use client";

import { AlertTriangle, Check, Clock, Lock, RefreshCw, ShieldCheck, Smartphone, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQrLogin } from "@/core/api/client/react";
import { ERROR_MESSAGES, isApiError, type QrStatus } from "@/core/contract";
import { btn, errorMessage, Spinner } from "@/core/ui";
import { QrCode } from "./qr-code";

type View = QrStatus | "loading" | "error";

/** Seconds until `iso`, ticking every second (never below 0). */
function useSecondsLeft(iso: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  return iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : 0;
}

const OVERLAY: Partial<Record<View, { icon: typeof Check; title: string; body: string; tone: string }>> = {
  scanned: { icon: Smartphone, title: "Approve on your phone", body: "We sent a sign-in request to your phone.", tone: "bg-dark text-on-dark" },
  approved: { icon: Check, title: "Signed in", body: "Taking you to your account…", tone: "bg-success text-white" },
  denied: { icon: X, title: "Sign-in denied", body: "Your phone declined this request.", tone: "bg-danger text-white" },
  expired: { icon: Clock, title: "Code expired", body: ERROR_MESSAGES.QR_EXPIRED, tone: "bg-dark text-on-dark" },
  consumed: { icon: Lock, title: "Code already used", body: ERROR_MESSAGES.QR_ALREADY_USED, tone: "bg-dark text-on-dark" },
};

/**
 * Desktop sign-in with a phone: shows a code, polls its status (every 2 s, in useQrLogin) and, once the phone
 * approves, swaps the code for a session and continues to `next`. The status the API reports is the truth;
 * the countdown is only a hint.
 */
export function QrPanel({ next }: { next: string }) {
  const router = useRouter();
  const { create, status, consume, code } = useQrLogin();
  const started = useRef(false);
  const consumedFor = useRef<string | null>(null);

  // One code per visit; "Get a new code" asks for another.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create.mutate();
  }, [create]);

  const remote = status.data?.status ?? "pending";
  const left = useSecondsLeft(status.data?.expiresAt ?? code?.expiresAt ?? null);

  // The phone approved: exchange the code for a session once, then go on.
  useEffect(() => {
    if (remote !== "approved" || !code || consumedFor.current === code.id) return;
    consumedFor.current = code.id;
    consume.mutate(undefined, { onSuccess: () => router.replace(next) });
  }, [remote, code, consume, router, next]);

  const consumeCode = isApiError(consume.error) ? consume.error.code : null;
  const statusCode = isApiError(status.error) ? status.error.code : null;
  const view: View = consume.isSuccess
    ? "approved"
    : consumeCode === "QR_EXPIRED" || statusCode === "QR_EXPIRED"
      ? "expired"
      : consumeCode === "QR_ALREADY_USED" || statusCode === "QR_ALREADY_USED"
        ? "consumed"
        : create.isError || consume.isError || (status.isError && !status.data)
          ? "error"
          : create.isPending || !code
            ? "loading"
            : remote;

  const failure = create.error ?? consume.error ?? status.error;
  const o = OVERLAY[view];
  const final = view === "denied" || view === "expired" || view === "consumed" || view === "error";
  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  const refresh = () => {
    consume.reset();
    create.mutate();
  };

  return (
    <section aria-labelledby="qr-title" className="rounded-[24px] bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="relative size-[116px] shrink-0 rounded-[16px] bg-surface-2 p-2">
          {code ? <QrCode value={code.approveUrl} dim={view !== "pending"} /> : <div className="shimmer size-full rounded-[10px]" aria-hidden />}
          {(o || view === "error" || view === "loading") && (
            <div className="absolute inset-0 grid place-items-center" aria-hidden>
              {view === "loading" ? (
                <Spinner className="text-ink-3" />
              ) : view === "error" ? (
                <span className="grid size-11 place-items-center rounded-full bg-danger text-white">
                  <AlertTriangle size={20} />
                </span>
              ) : o ? (
                <span className={`grid size-11 place-items-center rounded-full ${o.tone}`}>{view === "approved" ? <Spinner className="text-white" /> : <o.icon size={20} />}</span>
              ) : null}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1" aria-live="polite">
          <h2 id="qr-title" className="flex items-center gap-2 font-semibold text-ink">
            <ShieldCheck size={17} className="shrink-0 text-success" aria-hidden /> Or sign in with your phone
          </h2>
          {view === "error" ? (
            <>
              <p className="mt-1.5 text-sm font-semibold text-ink">Couldn&apos;t show a code</p>
              <p className="text-sm text-ink-3">{errorMessage(failure)}</p>
            </>
          ) : o ? (
            <>
              <p className="mt-1.5 text-sm font-semibold text-ink">{o.title}</p>
              <p className="text-sm text-ink-3">{o.body}</p>
            </>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">Open SOCIMCO on your phone, go to Account → Approve a computer, and scan this code.</p>
          )}
          {(view === "pending" || view === "scanned") && (
            <p className="tabular mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-3">
              <Clock size={13} aria-hidden /> {view === "scanned" ? "Request valid for" : "Code refreshes in"} {mm}
            </p>
          )}
          {final && (
            <button type="button" onClick={refresh} disabled={create.isPending} className={btn("outline", "sm", "mt-2.5")}>
              {create.isPending ? <Spinner /> : <RefreshCw size={15} aria-hidden />} Get a new code
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
