"use client";

import { AlertTriangle, Check, Clock, Lock, RefreshCw, ShieldCheck, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMe, usePhoneCode } from "@/core/api/client/react";
import { isApiError } from "@/core/contract";
import { QrCode } from "@/core/features/auth/qr-code";
import { btn, errorMessage, formatSeconds, Spinner, useSecondsLeft } from "@/core/ui";

/**
 * Computer side of phone sign-in (Account → Sign in on your phone): shows a code for a signed-out phone to scan.
 * With "Ask me to confirm" on (the default), the phone waits until this computer clicks Allow.
 * Turning it off signs the phone in as soon as it scans: faster, but anyone who scans the code gets in.
 */
export function PhoneCodePanel({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const { create, status, decide, code } = usePhoneCode();
  const [confirm, setConfirm] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create.mutate(true);
  }, [create]);

  const newCode = (requireApproval = confirm) => {
    decide.reset();
    create.mutate(requireApproval);
  };

  const remote = status.data?.status ?? "pending";
  const left = useSecondsLeft(status.data?.expiresAt ?? code?.expiresAt ?? null);
  const expired = remote === "expired" || (isApiError(decide.error) && decide.error.code === "QR_EXPIRED");
  const failure = create.error ?? (status.isError && !status.data ? status.error : null);
  const busy = create.isPending || !code;
  const showCode = !busy && !failure && (remote === "pending" || remote === "scanned");
  // e.g. "Safari sur iOS" (the API describes the phone in French).
  const requestedFrom = status.data?.requestedFrom ?? null;

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
        <h2 className="display flex items-center gap-2 text-[22px]">
          <Smartphone size={20} aria-hidden /> Connecter votre téléphone
        </h2>
        <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Fermer">
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-[340px]">
          {/* The code (dimmed once something has happened) */}
          <div className="relative mx-auto size-[240px] rounded-[24px] bg-white p-3 shadow-[0_10px_30px_-20px_rgb(0_0_0/0.5)] ring-1 ring-black/5">
            {code ? <QrCode value={code.scanUrl} dim={!showCode || remote === "scanned"} /> : <div className="shimmer size-full rounded-[14px]" aria-hidden />}
            {(busy || !showCode || remote === "scanned") && (
              <div className="absolute inset-0 grid place-items-center" aria-hidden>
                {busy ? (
                  <Spinner className="text-ink-3" />
                ) : failure ? (
                  <span className="grid size-14 place-items-center rounded-full bg-danger text-white"><AlertTriangle size={24} /></span>
                ) : remote === "consumed" ? (
                  <span className="grid size-14 place-items-center rounded-full bg-success text-white"><Check size={26} /></span>
                ) : remote === "approved" ? (
                  <span className="grid size-14 place-items-center rounded-full bg-success text-white"><Spinner className="text-white" /></span>
                ) : remote === "scanned" ? (
                  <span className="grid size-14 place-items-center rounded-full bg-dark text-on-dark"><Smartphone size={24} /></span>
                ) : remote === "denied" ? (
                  <span className="grid size-14 place-items-center rounded-full bg-danger text-white"><X size={26} /></span>
                ) : (
                  <span className="grid size-14 place-items-center rounded-full bg-dark text-on-dark">{expired ? <Clock size={24} /> : <Lock size={24} />}</span>
                )}
              </div>
            )}
          </div>

          <div className="mt-6" aria-live="polite">
            {failure ? (
              <Message title="Impossible d'afficher un code" body={errorMessage(failure)} action={<NewCodeButton onClick={() => newCode()} />} />
            ) : remote === "scanned" ? (
              <div className="rounded-[20px] bg-dark p-5 text-on-dark">
                <p className="font-semibold">{requestedFrom ? `Autoriser ce téléphone (${requestedFrom}) à se connecter ?` : "Autoriser ce téléphone à se connecter ?"}</p>
                <p className="mt-1 text-sm text-on-dark-2">
                  {me.data ? `Il sera connecté au compte de ${me.data.user.name} (${me.data.user.company}).` : "Il sera connecté à votre compte."} N&apos;autorisez que s&apos;il
                  s&apos;agit de votre téléphone, en main, en ce moment.
                </p>
                {decide.isError && !expired && <p className="mt-3 text-sm font-medium text-danger-soft">{errorMessage(decide.error)}</p>}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => decide.mutate("approve")} disabled={decide.isPending} className={btn("light", "md", "w-full")}>
                    {decide.isPending && decide.variables === "approve" ? <Spinner /> : <Check size={17} aria-hidden />} Autoriser
                  </button>
                  <button
                    type="button"
                    onClick={() => decide.mutate("deny")}
                    disabled={decide.isPending}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/25 px-4 text-[14px] font-semibold hover:bg-white/10"
                  >
                    {decide.isPending && decide.variables === "deny" ? <Spinner /> : <X size={17} aria-hidden />} Refuser
                  </button>
                </div>
              </div>
            ) : remote === "approved" ? (
              <Message title="Autorisé" body="Finalisation sur votre téléphone…" />
            ) : remote === "consumed" ? (
              <Message
                title="Votre téléphone est connecté"
                body={code?.requireApproval === false ? "Un téléphone a scanné le code et a été connecté à votre compte." : "Vous pouvez fermer ce panneau."}
                action={
                  <button type="button" onClick={onClose} className={btn("primary", "md")}>
                    Terminé
                  </button>
                }
              />
            ) : remote === "denied" ? (
              <Message title="Téléphone refusé" body="Aucune connexion n'a eu lieu." action={<NewCodeButton onClick={() => newCode()} />} />
            ) : expired ? (
              <Message title="Code expiré" body="Un code est valable 2 minutes. Affichez-en un nouveau pour réessayer." action={<NewCodeButton onClick={() => newCode()} />} />
            ) : (
              <>
                <ol className="space-y-2.5 text-[15px] text-ink-2">
                  {["Sur votre téléphone, ouvrez la page de connexion SOCIMCO.", "Touchez « Scanner un QR code ».", "Visez ce code avec le téléphone."].map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-dark text-[12px] font-bold text-on-dark">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <p className="tabular mt-4 flex items-center justify-between gap-3 text-[13px] text-ink-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={14} aria-hidden /> Le code expire dans {formatSeconds(left)}
                  </span>
                  <button type="button" onClick={() => newCode()} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink hover:underline">
                    <RefreshCw size={14} aria-hidden /> Nouveau code
                  </button>
                </p>
              </>
            )}
          </div>

          {/* Mode switch: changing it makes a new code with that setting. */}
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-[20px] bg-surface p-4 ring-1 ring-black/5">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={confirm}
              onChange={(e) => {
                setConfirm(e.target.checked);
                newCode(e.target.checked);
              }}
            />
            <span
              aria-hidden
              className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-line-strong transition-colors peer-checked:bg-success peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck size={16} className="text-success" aria-hidden /> Me demander de confirmer sur cet ordinateur
              </span>
              <span className="mt-0.5 block text-sm text-ink-3">
                {confirm
                  ? "Recommandé. Vous cliquerez sur Autoriser ici avant que le téléphone soit connecté."
                  : "Désactivé : toute personne qui scanne ce code dans les 2 prochaines minutes sera connectée à votre compte. À utiliser seulement si personne d'autre ne voit votre écran."}
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

function Message({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="text-center">
      <p className="display text-[22px]">{title}</p>
      <p className="mt-1 text-ink-3">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

function NewCodeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={btn("primary", "md")}>
      <RefreshCw size={16} aria-hidden /> Afficher un nouveau code
    </button>
  );
}
