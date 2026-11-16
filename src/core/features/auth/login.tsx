"use client";

import { AlertTriangle, Clock, Eye, EyeOff, Headset, Lock, ScanQrCode, Truck, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { qrLoginEnabled } from "@/core/api/client/config";
import { useLogin, useMe } from "@/core/api/client/react";
import { ERROR_MESSAGES, isApiError } from "@/core/contract";
import { BrandLogo, btn, errorMessage, Spinner, useMediaQuery } from "@/core/ui";
import { QR_PATHS } from "./qr-link";
import { QrPanel } from "./qr-panel";
import { safeNext } from "./safe-next";

const MONO = "font-[family-name:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

/* ---------- Password form ---------- */

function loginMessage(error: unknown): string {
  if (!isApiError(error)) return errorMessage(error);
  switch (error.code) {
    case "VALIDATION_FAILED":
      return "Saisissez votre identifiant et votre mot de passe.";
    case "RATE_LIMITED":
      return `${ERROR_MESSAGES.RATE_LIMITED} Vous pourrez réessayer dans 15 minutes.`;
    default:
      return ERROR_MESSAGES[error.code] ?? errorMessage(error);
  }
}

function PasswordForm({ next, expired, scanToSignIn }: { next: string; expired: boolean; scanToSignIn: boolean }) {
  const router = useRouter();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [missing, setMissing] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (login.isPending || login.isSuccess) return;
    if (!username.trim() || !password) {
      setMissing(true);
      login.reset();
      return;
    }
    setMissing(false);
    login.mutate({ username: username.trim(), password }, { onSuccess: () => router.replace(next) });
  };

  const code = isApiError(login.error) ? login.error.code : null;
  const message = missing ? "Saisissez votre identifiant et votre mot de passe." : login.isError ? loginMessage(login.error) : null;
  const fieldErr = missing || code === "INVALID_CREDENTIALS" || code === "VALIDATION_FAILED";
  const busy = login.isPending || login.isSuccess;
  const input = (bad: boolean) =>
    `h-12 w-full rounded-[var(--radius-control)] border bg-surface px-4 text-[16px] outline-none transition-colors placeholder:text-ink-3 focus:border-ink ${bad ? "border-danger" : "border-line-strong"}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col rounded-[28px] bg-surface p-6 sm:p-7" aria-describedby={message ? "login-error" : undefined}>
      <h2 className="display text-[24px] leading-tight sm:text-[26px]">Se connecter avec votre mot de passe</h2>
      <p className="mt-1 text-ink-3">Utilisez les identifiants fournis par votre chargé de compte.</p>

      {expired && !message && (
        <div className="mt-5 flex gap-3 rounded-[18px] bg-accent-soft p-4 text-sm" role="status">
          <Clock size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <p>
            <span className="font-semibold">Votre session a expiré.</span> Par sécurité, une session dure 12 heures. Reconnectez-vous pour reprendre où vous en étiez : votre panier est conservé.
          </p>
        </div>
      )}

      <div aria-live="assertive">
        {message && (
          <div id="login-error" className="mt-5 flex gap-3 rounded-[18px] bg-danger-soft p-4 text-sm text-danger" role="alert">
            {code === "RATE_LIMITED" ? <Lock size={18} className="mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />}
            <p className="font-medium">{message}</p>
          </div>
        )}
      </div>

      <label htmlFor="username" className="mt-6 text-sm font-semibold">
        Identifiant
      </label>
      <input
        id="username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        aria-invalid={fieldErr || undefined}
        className={`mt-1.5 ${input(fieldErr && (code === "INVALID_CREDENTIALS" || !username.trim()))}`}
      />
      <label htmlFor="password" className="mt-4 text-sm font-semibold">
        Mot de passe
      </label>
      <div className="relative mt-1.5">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={fieldErr || undefined}
          className={`${input(fieldErr && (code === "INVALID_CREDENTIALS" || !password))} pr-14`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={show}
        >
          {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>

      <button type="submit" disabled={busy} className={btn("primary", "lg", "mt-6 w-full")} aria-busy={busy || undefined}>
        {busy ? (
          <>
            <Spinner /> Connexion…
          </>
        ) : (
          "Se connecter"
        )}
      </button>

      {/* Phones: sign in with the code a signed-in computer shows (Account → Sign in on your phone). */}
      {scanToSignIn && (
        <div className="lg:hidden">
          <div className="my-4 flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-3" aria-hidden>
            <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
          </div>
          {/* The full glossary wording ("Scanner un QR code pour se connecter") is too long for a one-line pill on phones. */}
          <Link href={QR_PATHS.signInPhone} className={btn("outline", "lg", "w-full")} aria-label="Scanner un QR code pour se connecter">
            <ScanQrCode size={18} aria-hidden /> Scanner un QR code
          </Link>
          <p className="mt-2 text-center text-[13px] text-ink-3">Déjà connecté sur un ordinateur ? Ouvrez-y Compte → Connecter votre téléphone.</p>
        </div>
      )}

      <p className="mt-5 text-sm leading-relaxed text-ink-3">
        SOCIMCO est un portail professionnel privé. Les comptes sont ouverts par notre service commercial : il n&apos;y a pas d&apos;inscription en ligne. Mot de passe oublié ? Appelez votre chargé de compte.
      </p>
    </form>
  );
}

/* ---------- Phone: sign in, then scan a computer's code ---------- */

const SCAN_PATH = QR_PATHS.approveComputer;

/** True when the customer chose "sign in here, then scan a computer's code". */
const scansAfterSignIn = (next: string) => next === SCAN_PATH || next.startsWith(`${SCAN_PATH}?`);

/**
 * On a phone, the QR code isn't for signing in here; it's how this phone signs a computer in.
 * This card says so, and lets the customer go straight to the scanner after the password step.
 */
function PhoneScanCard({ next }: { next: string }) {
  if (scansAfterSignIn(next)) {
    return (
      <div className="flex items-start gap-3 rounded-[24px] bg-dark p-5 text-on-dark" role="status">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
          <ScanQrCode size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Scannez ensuite le code de l&apos;ordinateur</p>
          <p className="mt-0.5 text-sm text-on-dark-2">Une fois connecté, vous arrivez directement sur le scanner. Visez le QR code affiché sur la page de connexion de l&apos;ordinateur.</p>
        </div>
        <Link href="/login" replace className="grid size-11 shrink-0 place-items-center rounded-full text-on-dark-2 hover:bg-white/10 hover:text-on-dark" aria-label="Se connecter sans scanner">
          <X size={18} aria-hidden />
        </Link>
      </div>
    );
  }
  return (
    <Link
      href={`/login?next=${encodeURIComponent(SCAN_PATH)}`}
      replace
      className="group flex items-center gap-3 rounded-[24px] bg-surface p-5 ring-1 ring-black/5 hover:bg-surface-2"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-dark text-on-dark">
        <ScanQrCode size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Vous préférez vous connecter sur un ordinateur ?</span>
        <span className="block text-sm text-ink-3">Connectez-vous sur ce téléphone, puis scannez le QR code affiché sur l&apos;écran de l&apos;ordinateur. Aucun mot de passe à saisir sur l&apos;ordinateur.</span>
      </span>
    </Link>
  );
}

/* ---------- The two ways in (reads ?next= and ?reason=, so it renders inside Suspense) ---------- */

function SignInForms() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const expired = params.get("reason") === "expired";
  const me = useMe();
  // Computers show a QR code to sign in with; phones sign in with a password and then scan computers' codes.
  const desktop = useMediaQuery("(min-width: 1024px)");
  const qr = qrLoginEnabled();

  // Already signed in (another tab, or the back button): carry on.
  useEffect(() => {
    if (me.data) router.replace(next);
  }, [me.data, router, next]);

  return (
    <div className="flex flex-col gap-3">
      <PasswordForm next={next} expired={expired} scanToSignIn={qr && !scansAfterSignIn(next)} />
      {/* CSS hides the phone card on desktop widths, so it never flashes there before the QR panel loads. */}
      {qr && (
        <div className="lg:hidden">
          <PhoneScanCard next={next} />
        </div>
      )}
      {qr && desktop && <QrPanel next={next} />}
    </div>
  );
}

function FormsFallback() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="shimmer h-[468px] rounded-[28px]" />
      <span className="sr-only">Chargement de la connexion…</span>
    </div>
  );
}

function Year() {
  return <>{new Date().getFullYear()}</>;
}

/** Headline-led sign-in (option C): the home hero's type and green marker do the work; no photos. */
export function LoginScreen() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1240px] flex-col px-4 py-4 lg:px-8 lg:py-6">
      <header className="flex items-center justify-between gap-4">
        <BrandLogo className="h-10 lg:h-12" priority />
        <span className={`${MONO} text-[11px] uppercase tracking-[0.14em] text-ink-3`}>Portail privé</span>
      </header>

      <main className="grid flex-1 items-center gap-7 py-6 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-10">
        <div>
          <span className={`${MONO} inline-flex items-center rounded-[6px] border-2 border-success px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-success`}>
            Compte professionnel · SOCIMCO
          </span>
          <h1 className="display mt-4 text-[34px] leading-[0.98] min-[375px]:text-[40px] text-ink sm:text-[56px] lg:mt-5 xl:text-[72px]" style={{ fontWeight: 800, letterSpacing: "-0.045em" }}>
            <span className="block">Connectez-vous.</span>
            <span className="relative isolate inline-block whitespace-nowrap">
              <span className="absolute -inset-x-2 bottom-[0.06em] top-[0.46em] -z-10 -rotate-1 rounded-[6px] bg-accent" aria-hidden />
              Fixez votre prix.
            </span>
          </h1>
          <p className="mt-5 hidden max-w-[460px] text-[17px] leading-relaxed text-ink-3 sm:block lg:text-[18px]">
            Votre compte professionnel SOCIMCO : commandez par centaines et convenez de votre propre prix unitaire avec le service commercial.
          </p>
          <ul className={`${MONO} mt-8 hidden flex-wrap gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.12em] text-ink-3 sm:flex`}>
            <li className="flex items-center gap-2">
              <Truck size={15} aria-hidden /> Livré J+1 si commandé avant 14 h
            </li>
            <li className="flex items-center gap-2">
              <Clock size={15} aria-hidden /> Prix garantis 24 h
            </li>
            <li className="flex items-center gap-2">
              <Headset size={15} aria-hidden /> Service commercial dédié
            </li>
          </ul>
        </div>

        <Suspense fallback={<FormsFallback />}>
          <SignInForms />
        </Suspense>
      </main>

      <p className="pb-1 pt-2 text-center text-xs text-ink-3">
        ©{" "}
        <Suspense fallback={null}>
          <Year />
        </Suspense>{" "}
        SOCIMCO · Portail professionnel privé
      </p>
    </div>
  );
}
