"use client";

import { Check, Clock, Laptop, Lock, ScanLine, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useMe, usePhoneSignIn } from "@/core/api/client/react";
import { ERROR_MESSAGES, isApiError } from "@/core/contract";
import { btn, errorMessage, ErrorTile, formatSeconds, Spinner, useSecondsLeft } from "@/core/ui";
import { PhoneFrame } from "./qr-approve";
import { QR_PATHS } from "./qr-link";
import { QrScanner } from "./qr-scanner";

/*
 * Phone sign-in, the phone's half: /qr/sign-in scans the code a signed-in computer shows
 * (Account → Sign in on your phone); /qr/sign-in?code=… redeems it. Depending on how the computer made
 * the code, the phone is signed in at once, or waits until the computer clicks Allow.
 */

type Ending = "expired" | "used" | "invalid" | "denied";

const ENDINGS: Record<Ending, { icon: typeof Check; title: string; body: string }> = {
  expired: { icon: Clock, title: "Code expired", body: `${ERROR_MESSAGES.QR_EXPIRED} Show a new code on your computer and scan it again.` },
  used: { icon: Lock, title: "Already used", body: `${ERROR_MESSAGES.QR_ALREADY_USED} Show a new code on your computer.` },
  invalid: { icon: X, title: "Code not recognised", body: "This isn't a current sign-in code. Show a new code on your computer and scan it again." },
  denied: { icon: X, title: "Sign-in declined", body: "The computer didn't allow this phone. If that wasn't you, nothing has changed." },
};

const endingFor = (e: unknown): Ending | null =>
  isApiError(e) ? (e.code === "QR_EXPIRED" ? "expired" : e.code === "QR_ALREADY_USED" ? "used" : e.code === "NOT_FOUND" ? "invalid" : null) : null;

function Centered({ icon: Icon, tone, title, body, children }: { icon: typeof Check; tone: string; title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col" aria-live="polite">
      <div className="mt-16 flex flex-col items-center text-center">
        <span className={`grid size-20 place-items-center rounded-full ${tone}`}>
          <Icon size={34} aria-hidden />
        </span>
        <h1 className="display mt-6 text-[34px] leading-tight">{title}</h1>
        <div className="mt-2 max-w-sm text-ink-3">{body}</div>
      </div>
      {children && <div className="mt-auto space-y-2.5 pt-10">{children}</div>}
    </div>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <div className="grid flex-1 place-items-center text-ink-3" aria-busy="true">
      <Spinner />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function EndingView({ ending }: { ending: Ending }) {
  const e = ENDINGS[ending];
  return (
    <Centered icon={e.icon} tone="bg-dark text-on-dark" title={e.title} body={e.body}>
      <Link href={QR_PATHS.signInPhone} className={btn("primary", "lg", "w-full")}>
        <ScanLine size={18} aria-hidden /> Scan again
      </Link>
      <Link href="/login" className={btn("outline", "lg", "w-full")}>
        Sign in with password
      </Link>
    </Centered>
  );
}

/** Redeems the scanned code once, then either goes in or waits for the computer's Allow. */
function Redeem({ code }: { code: string }) {
  const router = useRouter();
  const { redeem, status, complete } = usePhoneSignIn();
  const started = useRef(false);
  const completing = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    redeem.mutate(code);
  }, [redeem, code]);

  const waiting = redeem.data?.status === "awaiting_approval" ? redeem.data : null;
  const remote = status.data?.status;
  const left = useSecondsLeft(status.data?.expiresAt ?? waiting?.expiresAt ?? null);

  // Signed in straight away (no approval needed), or after completing: go to the shop.
  useEffect(() => {
    if (redeem.data?.status === "signed_in" || complete.isSuccess) router.replace("/");
  }, [redeem.data, complete.isSuccess, router]);

  // The computer clicked Allow: swap the approval for this phone's session, once.
  useEffect(() => {
    if (remote !== "approved" || completing.current) return;
    completing.current = true;
    complete.mutate();
  }, [remote, complete]);

  const ending =
    endingFor(redeem.error) ??
    endingFor(complete.error) ??
    endingFor(status.error) ??
    (remote === "denied" ? "denied" : remote === "expired" ? "expired" : remote === "consumed" && !complete.isSuccess ? "used" : null);
  if (ending) return <EndingView ending={ending} />;

  const failure = redeem.error ?? complete.error ?? (status.isError && !status.data ? status.error : null);
  if (failure) {
    return (
      <div className="mt-10">
        <h1 className="display text-[30px] leading-tight">Couldn&apos;t sign you in</h1>
        <ErrorTile message={errorMessage(failure)} onRetry={() => router.replace(QR_PATHS.signInPhone)} className="mt-6" />
      </div>
    );
  }

  if (redeem.data?.status === "signed_in" || complete.isSuccess || remote === "approved") {
    return <Centered icon={Check} tone="bg-success text-white" title="You're signed in" body="Taking you to SOCIMCO…" />;
  }

  if (waiting) {
    const mm = formatSeconds(left);
    return (
      <Centered
        icon={Laptop}
        tone="bg-dark text-on-dark"
        title="Allow it on your computer"
        body={
          <>
            <p>Your computer is asking whether to sign this phone in. Click <span className="font-semibold text-ink">Allow</span> there.</p>
            <p className="tabular mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm">
              <Spinner className="size-3.5" /> Waiting… {mm}
            </p>
          </>
        }
      >
        <Link href="/login" className={btn("outline", "lg", "w-full")}>
          <Smartphone size={18} aria-hidden /> Cancel and use password
        </Link>
      </Centered>
    );
  }

  return <Busy label="Signing you in…" />;
}

/** /qr/sign-in — phone, signed out. */
export function PhoneSignInScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get("code")?.trim() ?? "";
  const me = useMe();
  // Only care about "already signed in" when arriving without a code.
  const signedIn = !code && !!me.data;

  return (
    <PhoneFrame>
      {signedIn ? (
        <Centered icon={Check} tone="bg-success text-white" title="You're already signed in" body={`This phone is signed in as ${me.data!.user.name}.`}>
          <Link href="/" className={btn("primary", "lg", "w-full")}>
            Go to SOCIMCO
          </Link>
        </Centered>
      ) : code ? (
        <Redeem key={code} code={code} />
      ) : (
        <QrScanner
          accept={QR_PATHS.signInPhone}
          title="Scan to sign in"
          intro="On your computer, signed in to SOCIMCO, open Account → Sign in on your phone. Then scan the code it shows."
          wrongCode="That isn't a SOCIMCO phone sign-in code. Use the code from Account → Sign in on your phone."
          onCode={(c) => router.replace(`${QR_PATHS.signInPhone}?code=${encodeURIComponent(c)}`)}
        />
      )}
    </PhoneFrame>
  );
}

export function PhoneSignInFallback() {
  return (
    <PhoneFrame>
      <Busy label="Loading…" />
    </PhoneFrame>
  );
}
