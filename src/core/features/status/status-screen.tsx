"use client";

import { ArrowRight, RefreshCw, Search, ServerCrash } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useCategories } from "@/core/api/client/react";
import { ERROR_MESSAGES } from "@/core/contract";
import { BASE, BrandLogo, btn, Spinner } from "@/core/ui";

const HOME = BASE || "/";

function PopularDepartments() {
  // Signed-out visitors can't load categories; then the list simply isn't shown.
  const categories = useCategories();
  const top = (categories.data?.categories ?? []).slice(0, 6);
  if (top.length === 0) return null;
  return (
    <div className="mt-10 border-t border-canvas pt-6">
      <p className="text-sm font-semibold">Rayons populaires</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {top.map((c) => (
          <li key={c.id}>
            <Link href={`${BASE}/category/${c.slug}`} className="inline-flex h-11 items-center rounded-full bg-surface-2 px-4 text-sm font-medium hover:bg-canvas">
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Not-found and unexpected-error pages. `standalone` adds the logo header for pages shown outside the shop
 * layout (the root 404 and error boundary); inside the shop the header and footer are already there.
 */
export function StatusScreen({ kind, onRetry, standalone = false }: { kind: "404" | "error"; onRetry?: () => void; standalone?: boolean }) {
  const [retrying, startRetry] = useTransition();
  const [retried, setRetried] = useState(false);

  const copy =
    kind === "404"
      ? { eyebrow: "Introuvable", title: "Page introuvable", body: "Le lien est peut-être ancien, ou le produit a été déplacé. Lancez une recherche ou partez d'un rayon." }
      : { eyebrow: "Erreur", title: "Une erreur s'est produite", body: `${ERROR_MESSAGES.INTERNAL} Votre panier et vos devis sont conservés.` };

  const big: ReactNode =
    kind === "404" ? (
      <span className="bg-[linear-gradient(100deg,#c9f2c9,#35b335)] bg-clip-text text-transparent">404</span>
    ) : (
      <ServerCrash size={64} strokeWidth={1.5} aria-hidden />
    );

  const body = (
    <div className="grid gap-3 lg:grid-cols-12 lg:gap-4">
      <div className="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-[32px] bg-dark text-on-dark sm:min-h-[260px] lg:col-span-5 lg:min-h-[460px]">
        <div className="absolute -left-24 -top-24 size-[380px] rounded-full bg-[radial-gradient(circle,rgb(53_179_53/0.3),transparent_65%)]" aria-hidden />
        <span className="display relative text-[120px] leading-none lg:text-[180px]" aria-hidden={kind === "404" || undefined}>
          {big}
        </span>
      </div>
      <div className="flex flex-col justify-center rounded-[32px] bg-surface p-8 lg:col-span-7 lg:p-12">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{copy.eyebrow}</p>
        <h1 className="display mt-2 text-[36px] leading-[1.05] sm:text-[48px]">{copy.title}</h1>
        <p className="mt-3 max-w-lg text-[16px] text-ink-2">{copy.body}</p>

        <div className="mt-8 flex flex-wrap gap-2">
          {kind === "404" ? (
            <>
              <Link href={HOME} className={btn("primary", "lg")}>
                Retour à l&apos;accueil <ArrowRight size={17} aria-hidden />
              </Link>
              <Link href={`${BASE}/search`} className={btn("outline", "lg")}>
                <Search size={17} aria-hidden /> Rechercher un produit
              </Link>
            </>
          ) : (
            <>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => {
                    setRetried(true);
                    startRetry(onRetry);
                  }}
                  disabled={retrying}
                  aria-busy={retrying || undefined}
                  className={btn("primary", "lg")}
                >
                  {retrying ? <Spinner /> : <RefreshCw size={17} aria-hidden />} {retrying ? "Nouvelle tentative…" : "Réessayer"}
                </button>
              )}
              <Link href={HOME} className={btn("outline", "lg")}>
                Retour à l&apos;accueil
              </Link>
            </>
          )}
        </div>
        {kind === "error" && retried && !retrying && (
          <p role="status" className="mt-4 text-sm text-ink-3">
            Le problème persiste. S&apos;il se reproduit, contactez votre service commercial.
          </p>
        )}

        {kind === "404" && <PopularDepartments />}
      </div>
    </div>
  );

  if (!standalone) return <div className="mx-auto max-w-[1400px] px-3 pb-16 pt-5 lg:px-6 lg:pb-6">{body}</div>;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col px-3 py-4 lg:px-6 lg:py-6">
      <header className="flex items-center px-1 pb-4">
        <Link href={HOME} aria-label="Accueil SOCIMCO" className="inline-flex min-h-11 items-center">
          <BrandLogo className="h-10 lg:h-12" priority />
        </Link>
      </header>
      <main className="flex flex-1 flex-col justify-center">{body}</main>
    </div>
  );
}
