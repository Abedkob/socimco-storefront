"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/core/api/client/react";
import { isApiError } from "@/core/contract";
import { BrandLogo, ErrorTile, Spinner, errorMessage } from "@/core/ui";

/**
 * The shop is private: every page behind this gate needs a signed-in customer.
 * It asks the API who is signed in (works for cookie and bearer auth, same- or cross-origin)
 * and sends anyone signed out to /login, coming back to the same page afterwards.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const signedOut = isApiError(me.error) && me.error.code === "UNAUTHENTICATED";
  // Signed in a moment ago and now refused: the session ran out (signing out clears `me.data` first).
  const expired = signedOut && !!me.data;

  useEffect(() => {
    if (!signedOut) return;
    // Read the address here rather than with usePathname(): that hook would make every dynamic shop route
    // (/orders/[id], /products/[slug]) block prerendering, and this way the query string comes back too.
    const here = `${window.location.pathname}${window.location.search}` || "/";
    router.replace(`/login?next=${encodeURIComponent(here)}${expired ? "&reason=expired" : ""}`);
  }, [signedOut, expired, router]);

  if (me.isPending || signedOut) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <div className="flex flex-col items-center gap-4 text-ink-3">
          <BrandLogo className="h-12" priority />
          <Spinner />
          <span className="sr-only">Loading your account…</span>
        </div>
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-xl place-items-center px-4">
        <ErrorTile message={errorMessage(me.error)} onRetry={() => void me.refetch()} className="w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
