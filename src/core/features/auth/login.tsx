"use client";

import { AlertTriangle, Clock, Eye, EyeOff, Headset, Lock, ScanQrCode, Truck, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { qrLoginEnabled } from "@/core/api/client/config";
import { useLogin, useMe } from "@/core/api/client/react";
import { ERROR_MESSAGES, isApiError } from "@/core/contract";
import { BrandLogo, btn, errorMessage, Spinner, useMediaQuery } from "@/core/ui";
import { QrPanel } from "./qr-panel";
import { safeNext } from "./safe-next";

const MONO = "font-[family-name:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";

/* ---------- Password form ---------- */

function loginMessage(error: unknown): string {
  if (!isApiError(error)) return errorMessage(error);
  switch (error.code) {
    case "VALIDATION_FAILED":
      return "Enter your username and password.";
    case "RATE_LIMITED":
      return `${ERROR_MESSAGES.RATE_LIMITED} You can try again in 15 minutes.`;
    default:
      return ERROR_MESSAGES[error.code] ?? errorMessage(error);
  }
}

function PasswordForm({ next, expired }: { next: string; expired: boolean }) {
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
  const message = missing ? "Enter your username and password." : login.isError ? loginMessage(login.error) : null;
  const fieldErr = missing || code === "INVALID_CREDENTIALS" || code === "VALIDATION_FAILED";
  const busy = login.isPending || login.isSuccess;
  const input = (bad: boolean) =>
    `h-12 w-full rounded-[var(--radius-control)] border bg-surface px-4 text-[16px] outline-none transition-colors placeholder:text-ink-3 focus:border-ink ${bad ? "border-danger" : "border-line-strong"}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col rounded-[28px] bg-surface p-6 sm:p-7" aria-describedby={message ? "login-error" : undefined}>
      <h2 className="display text-[24px] leading-tight sm:text-[26px]">Sign in with your password</h2>
      <p className="mt-1 text-ink-3">Use the details from your account manager.</p>

      {expired && !message && (
        <div className="mt-5 flex gap-3 rounded-[18px] bg-accent-soft p-4 text-sm" role="status">
          <Clock size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
          <p>
            <span className="font-semibold">Your session ended.</span> For security, sessions last 12 hours. Sign in again to pick up where you left off — your cart is saved.
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
        Username
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
        Password
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
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
        </button>
      </div>

      <button type="submit" disabled={busy} className={btn("primary", "lg", "mt-6 w-full")} aria-busy={busy || undefined}>
        {busy ? (
          <>
            <Spinner /> Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>

      <p className="mt-5 text-sm leading-relaxed text-ink-3">
        SOCIMCO is a private trade portal. Accounts are opened by our sales desk — there&apos;s no self sign-up. Forgotten your password? Call your account manager.
      </p>
    </form>
  );
}

/* ---------- Phone: sign in, then scan a computer's code ---------- */

const SCAN_PATH = "/qr/approve";

/**
 * On a phone, the QR code isn't for signing in here; it's how this phone signs a computer in.
 * This card says so, and lets the customer go straight to the scanner after the password step.
 */
function PhoneScanCard({ next }: { next: string }) {
  const scanAfter = next === SCAN_PATH || next.startsWith(`${SCAN_PATH}?`);
  if (scanAfter) {
    return (
      <div className="flex items-start gap-3 rounded-[24px] bg-dark p-5 text-on-dark" role="status">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
          <ScanQrCode size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Then scan the computer&apos;s code</p>
          <p className="mt-0.5 text-sm text-on-dark-2">After you sign in, you go straight to the scanner. Point it at the QR code on the computer&apos;s sign-in page.</p>
        </div>
        <Link href="/login" replace className="grid size-11 shrink-0 place-items-center rounded-full text-on-dark-2 hover:bg-white/10 hover:text-on-dark" aria-label="Don't scan, just sign in">
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
        <span className="block font-semibold">Signing in on a computer?</span>
        <span className="block text-sm text-ink-3">Sign in here, then scan the QR code on its screen. No password needed there.</span>
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
      <PasswordForm next={next} expired={expired} />
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
      <span className="sr-only">Loading sign-in…</span>
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
        <span className={`${MONO} text-[11px] uppercase tracking-[0.14em] text-ink-3`}>Private trade portal</span>
      </header>

      <main className="grid flex-1 items-center gap-7 py-6 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-10">
        <div>
          <span className={`${MONO} inline-flex items-center rounded-[6px] border-2 border-success px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-success`}>
            Trade account · SOCIMCO
          </span>
          <h1 className="display mt-4 text-[34px] leading-[0.98] min-[375px]:text-[40px] text-ink sm:text-[56px] lg:mt-5 xl:text-[72px]" style={{ fontWeight: 800, letterSpacing: "-0.045em" }}>
            <span className="block">Sign in.</span>
            <span className="relative isolate inline-block whitespace-nowrap">
              <span className="absolute -inset-x-2 bottom-[0.06em] top-[0.46em] -z-10 -rotate-1 rounded-[6px] bg-accent" aria-hidden />
              Name your price.
            </span>
          </h1>
          <p className="mt-5 hidden max-w-[460px] text-[17px] leading-relaxed text-ink-3 sm:block lg:text-[18px]">
            Your SOCIMCO trade account: order by the hundred and agree your own unit price with the sales desk.
          </p>
          <ul className={`${MONO} mt-8 hidden flex-wrap gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.12em] text-ink-3 sm:flex`}>
            <li className="flex items-center gap-2">
              <Truck size={15} aria-hidden /> Next-day before 2 pm
            </li>
            <li className="flex items-center gap-2">
              <Clock size={15} aria-hidden /> Prices held 24h
            </li>
            <li className="flex items-center gap-2">
              <Headset size={15} aria-hidden /> Named sales desk
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
        SOCIMCO · Private trade portal
      </p>
    </div>
  );
}
