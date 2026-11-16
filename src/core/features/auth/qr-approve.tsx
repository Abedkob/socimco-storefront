"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Clock, Laptop, Lock, ScanLine, ShieldCheck, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useApi, useMe } from "@/core/api/client/react";
import { ERROR_MESSAGES, isApiError } from "@/core/contract";
import { BrandLogo, btn, errorMessage, ErrorTile, formatTime, Spinner } from "@/core/ui";
import { QrScanner } from "./qr-scanner";

type Result = "approved" | "denied" | "expired" | "used" | "invalid";
/** Results where scanning a fresh code is the natural next step. */
const RESCAN: readonly Result[] = ["expired", "used", "invalid"];

const RESULT: Record<Result, { icon: typeof Check; tone: string; title: string; body: string }> = {
  approved: { icon: Check, tone: "bg-success text-white", title: "Ordinateur connecté", body: "L'ordinateur est maintenant connecté à votre compte. Vous pouvez fermer cet écran." },
  denied: { icon: X, tone: "bg-danger text-white", title: "Connexion refusée", body: "Personne n'a été connecté. Si ce n'était pas vous, prévenez votre chargé de compte." },
  expired: { icon: Clock, tone: "bg-dark text-on-dark", title: "Demande expirée", body: `${ERROR_MESSAGES.QR_EXPIRED} Scannez le nouveau code affiché sur votre ordinateur.` },
  used: { icon: Lock, tone: "bg-dark text-on-dark", title: "Code déjà utilisé", body: `${ERROR_MESSAGES.QR_ALREADY_USED} Chaque code ne connecte qu'un seul ordinateur, une seule fois.` },
  invalid: { icon: X, tone: "bg-dark text-on-dark", title: "Code non reconnu", body: "Ce lien n'est pas un code de connexion valide. Scannez à nouveau le code affiché sur votre ordinateur." },
};

/** The phone-screen frame (logo + "This phone"), shared by the QR approve and phone sign-in screens. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-4 pb-8 pt-5">
      <div className="flex items-center justify-between">
        <BrandLogo className="h-10" priority />
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[12px] font-semibold text-ink-2">
          <Smartphone size={14} aria-hidden /> Ce téléphone
        </span>
      </div>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  const r = RESULT[result];
  return (
    <div className="flex flex-1 flex-col" aria-live="polite">
      <div className="mt-16 flex flex-col items-center text-center">
        <span className={`grid size-20 place-items-center rounded-full ${r.tone}`}>
          <r.icon size={34} aria-hidden />
        </span>
        <h1 className="display mt-6 text-[34px] leading-tight">{r.title}</h1>
        <p className="mt-2 max-w-sm text-ink-3">{r.body}</p>
      </div>
      <div className="mt-auto space-y-2.5 pt-10">
        {RESCAN.includes(result) && (
          <Link href="/qr/approve" className={btn("primary", "lg", "w-full")}>
            <ScanLine size={18} aria-hidden /> Scanner à nouveau
          </Link>
        )}
        <Link href="/" className={btn(RESCAN.includes(result) ? "outline" : "primary", "lg", "w-full")}>
          Retour à SOCIMCO
        </Link>
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="grid flex-1 place-items-center text-ink-3" aria-busy="true">
      <Spinner />
      <span className="sr-only">{label}</span>
    </div>
  );
}

const errorResult = (e: unknown): Result | null =>
  isApiError(e) ? (e.code === "QR_EXPIRED" ? "expired" : e.code === "QR_ALREADY_USED" ? "used" : e.code === "NOT_FOUND" ? "invalid" : null) : null;

/** The phone half of QR sign-in: confirm the scan, then approve or deny the computer. */
function Approve({ code }: { code: string }) {
  const api = useApi();
  const me = useMe();
  // Scanning tells the computer "a phone has this code"; it runs once per code.
  const scan = useQuery({
    queryKey: ["qr-scan", code],
    queryFn: () => api.qr.scan(code),
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const decide = useMutation({ mutationFn: (decision: "approve" | "deny") => api.qr.approve({ code, decision }) });

  if (decide.isSuccess) return <ResultView result={decide.data.status === "approved" ? "approved" : "denied"} />;
  const ended = errorResult(decide.error) ?? errorResult(scan.error);
  if (ended) return <ResultView result={ended} />;
  if (scan.isPending) return <Loading label="Vérification de la demande de connexion…" />;
  if (scan.isError) {
    return (
      <div className="mt-10">
        <h1 className="display text-[30px] leading-tight">Impossible de vérifier ce code</h1>
        <ErrorTile message={errorMessage(scan.error)} onRetry={() => void scan.refetch()} className="mt-6" />
      </div>
    );
  }

  const user = me.data?.user;
  const rows: [typeof Clock, string, string][] = [
    [Clock, "Demandé", `Aujourd'hui à ${formatTime(scan.data.requestedAt)}`],
    [ShieldCheck, "Compte", user ? `${user.name} · ${user.company}` : "Votre compte"],
  ];

  return (
    <>
      <h1 className="display mt-10 text-[36px] leading-[1.05]">Autoriser un ordinateur ?</h1>
      <p className="mt-2 text-ink-3">Quelqu&apos;un a scanné votre code de connexion. N&apos;autorisez que si c&apos;est bien vous, devant cet ordinateur, en ce moment.</p>

      <div className="mt-6 overflow-hidden rounded-[28px] bg-surface">
        <div className="flex items-center gap-4 bg-dark p-5 text-on-dark">
          <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-white/10">
            <Laptop size={22} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{scan.data.requestedFrom}</p>
            <p className="text-sm text-on-dark-2">Navigateur d&apos;ordinateur</p>
          </div>
        </div>
        <dl className="divide-y divide-line px-5 text-[15px]">
          {rows.map(([I, k, v]) => (
            <div key={k} className="flex items-start gap-3 py-3.5">
              <I size={18} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              <dt className="w-24 shrink-0 text-ink-3">{k}</dt>
              <dd className="min-w-0 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {decide.isError && (
        <p role="alert" className="mt-4 rounded-[18px] bg-danger-soft p-4 text-sm font-medium text-danger">
          {errorMessage(decide.error)}
        </p>
      )}

      <div className="mt-auto space-y-2.5 pt-8">
        <button type="button" onClick={() => decide.mutate("approve")} disabled={decide.isPending} className={btn("primary", "lg", "w-full")}>
          {decide.isPending && decide.variables === "approve" ? <Spinner /> : <Check size={18} aria-hidden />} Autoriser
        </button>
        <button type="button" onClick={() => decide.mutate("deny")} disabled={decide.isPending} className={btn("outline", "lg", "w-full")}>
          {decide.isPending && decide.variables === "deny" ? <Spinner /> : <X size={18} aria-hidden />} Refuser
        </button>
      </div>
    </>
  );
}

/**
 * /qr/approve: the in-app scanner (Account → Approve a computer).
 * /qr/approve?code=…: the approval itself, reached from the scanner or by scanning with the phone's camera app.
 * Both need the phone to be signed in first.
 */
export function QrApproveScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code")?.trim() ?? "";
  const me = useMe();
  const signedOut = isApiError(me.error) && me.error.code === "UNAUTHENTICATED";

  useEffect(() => {
    if (!signedOut) return;
    const here = code ? `/qr/approve?code=${encodeURIComponent(code)}` : "/qr/approve";
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [signedOut, code, router]);

  return (
    <PhoneFrame>
      {me.isPending || signedOut ? (
        <Loading label="Vérification de votre compte…" />
      ) : me.isError ? (
        <div className="mt-10">
          <h1 className="display text-[30px] leading-tight">Impossible de vérifier votre compte</h1>
          <ErrorTile message={errorMessage(me.error)} onRetry={() => void me.refetch()} className="mt-6" />
        </div>
      ) : !code ? (
        <QrScanner onCode={(c) => router.replace(`/qr/approve?code=${encodeURIComponent(c)}`)} />
      ) : (
        <Approve key={code} code={code} />
      )}
    </PhoneFrame>
  );
}

export function QrApproveFallback() {
  return (
    <PhoneFrame>
      <Loading label="Chargement…" />
    </PhoneFrame>
  );
}
