"use client";

import { AlertTriangle, ArrowRight, Check, FileText, Lock, ShoppingBag, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useCart, useCartMutations, useCategories, useNegotiation } from "@/core/api/client/react";
import type { CartLine as CartLineData, Negotiation } from "@/core/contract";
import { isQuoteOpen } from "@/core/features/negotiation";
import { ActionLink, BASE, btn, ErrorTile, errorMessage, formatCount, formatMoney, PageHeader, ProductImage, Spinner, Stepper, TILE, unitLabel, useToast } from "@/core/ui";
import { clearShortLine, shortLinesFromError, useShortLines } from "./stock-flags";

const MAX_QTY = 99_999;

/**
 * Whether the line takes part in a trade quote. The cart only says yes/no (negotiationEligible);
 * the product's trade minimum isn't on cart lines, so there's no "add N more" meter here.
 */
function TradeMeter({ line }: { line: CartLineData }) {
  if (!line.negotiationEligible) {
    return <p className="text-[13px] text-ink-3">Prix catalogue · quantité insuffisante ou produit non négociable</p>;
  }
  return (
    <div className="max-w-[320px]">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
        <Check size={14} aria-hidden /> Éligible au prix négocié
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accent" aria-hidden />
    </div>
  );
}

function CartLine({ line, locked, available }: { line: CartLineData; locked: boolean; available: number | undefined }) {
  const { update, remove } = useCartMutations();
  const { notify } = useToast();
  const flagged = available !== undefined && available < line.quantity;
  const busy = update.isPending || remove.isPending;

  const setQuantity = (quantity: number, done?: string) =>
    update.mutate(
      { productId: line.productId, quantity },
      {
        onSuccess: () => {
          clearShortLine(line.productId);
          if (done) notify(done);
        },
        onError: (e) => {
          const available = shortLinesFromError(e)?.[line.productId];
          notify(available !== undefined ? `Seulement ${formatCount(available)} en stock pour ${line.name}.` : errorMessage(e), "danger");
        },
      },
    );

  const drop = () =>
    remove.mutate(line.productId, {
      onSuccess: () => {
        clearShortLine(line.productId);
        notify(`Retiré du panier : ${line.name}`, "info");
      },
      onError: (e) => notify(errorMessage(e), "danger"),
    });

  return (
    <li className={`${TILE} p-2.5 ${flagged ? "ring-2 ring-danger/50" : ""}`} aria-busy={busy || undefined}>
      <div className="flex gap-4">
        <div className="shrink-0 overflow-hidden rounded-[18px] bg-canvas">
          <ProductImage src={line.imageUrl} alt="" className="size-24 object-cover sm:size-28" />
        </div>
        <div className="min-w-0 flex-1 py-1.5 pr-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="tabular text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{line.sku}</p>
              <p className="font-semibold leading-snug">{line.name}</p>
              <p className="tabular mt-0.5 text-[13px] text-ink-3">
                {formatMoney(line.unitPriceCents)} / {unitLabel(line.unit, 1)}
              </p>
            </div>
            {!locked && (
              <button
                type="button"
                onClick={drop}
                disabled={busy}
                className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                aria-label={`Retirer ${line.name}`}
              >
                <Trash2 size={17} aria-hidden />
              </button>
            )}
          </div>
          <div className="mt-3 hidden sm:block">
            <TradeMeter line={line} />
          </div>
        </div>
      </div>
      <div className="mt-3 px-1.5 sm:hidden">
        <TradeMeter line={line} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-canvas px-1.5 pb-1 pt-3">
        <Stepper
          value={line.quantity}
          min={1}
          max={MAX_QTY}
          onChange={(q) => setQuantity(q)}
          size="sm"
          label={`Quantité : ${line.name}`}
          disabled={locked}
          className="w-[148px]"
        />
        <p className="tabular display flex items-center gap-2 text-[22px]">
          {busy && <Spinner className="text-ink-3" />}
          {formatMoney(line.lineTotalCents)}
        </p>
      </div>
      {flagged && (
        <div className="mx-1.5 mb-1.5 mt-3 flex flex-wrap items-center gap-3 rounded-[16px] bg-danger-soft p-3 text-sm text-danger" role="alert">
          <AlertTriangle size={17} className="shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">{available > 0 ? `Plus que ${formatCount(available)} en stock.` : "Rupture de stock."}</span>{" "}
            {available > 0 ? "Réduisez la quantité pour poursuivre votre commande." : "Retirez cette ligne pour poursuivre votre commande."}
          </p>
          {available > 0 ? (
            <button type="button" onClick={() => setQuantity(available, `Quantité ramenée à ${formatCount(available)}`)} disabled={locked || busy} className={btn("primary", "sm")}>
              Passer à {formatCount(available)}
            </button>
          ) : (
            <button type="button" onClick={drop} disabled={locked || busy} className={btn("primary", "sm")}>
              Retirer la ligne
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function EmptyCart() {
  const categories = useCategories();
  const top = (categories.data?.categories ?? []).slice(0, 4);
  return (
    <div className={`${TILE} mt-6 grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.2fr] lg:p-12`}>
      <div>
        <span className="grid size-14 place-items-center rounded-full bg-surface-2">
          <ShoppingBag size={24} aria-hidden />
        </span>
        <h2 className="display mt-5 text-[30px] leading-tight">Votre panier est vide</h2>
        <p className="mt-2 max-w-md text-ink-2">
          Ajoutez les quantités dont vous avez besoin. Les produits signalés «&nbsp;Négociable&nbsp;» vous donnent droit à votre propre prix dès 100 unités.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`${BASE}/category/power-tools`} className={btn("primary", "lg")}>
            Voir l&apos;outillage électroportatif <ArrowRight size={17} aria-hidden />
          </Link>
          <Link href={`${BASE}/orders`} className={btn("outline", "lg")}>
            Vos commandes
          </Link>
        </div>
      </div>
      {top.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 self-center sm:grid-cols-2">
          {top.map((c) => (
            <li key={c.id}>
              <Link href={`${BASE}/category/${c.slug}`} className="flex h-14 items-center justify-between gap-2 rounded-[18px] bg-surface-2 px-4 font-semibold hover:bg-canvas">
                <span className="truncate">{c.name}</span> <ArrowRight size={16} className="shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Summary({ subtotalCents, eligible, quote }: { subtotalCents: number; eligible: number; quote: Negotiation | undefined }) {
  const open = isQuoteOpen(quote);
  const accepted = quote?.status === "accepted";
  const savings = accepted ? (quote.savingsCents ?? 0) : 0;
  return (
    <div className={`${TILE} p-6`}>
      <h2 className="display text-[24px]">Récapitulatif</h2>
      <dl className="tabular mt-4 space-y-2 text-[15px]">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Sous-total au prix catalogue</dt>
          <dd className="font-semibold">{formatMoney(subtotalCents)}</dd>
        </div>
        {accepted && (
          <div className="flex justify-between gap-3 text-success">
            <dt>Économies négociées</dt>
            <dd className="font-semibold">−{formatMoney(savings)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Livraison</dt>
          <dd className="text-ink-2">Calculée à la commande</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-canvas pt-4">
        <span className="font-semibold">{accepted ? "Total convenu" : "Total"}</span>
        <span className="tabular display text-[32px] leading-none">{formatMoney(subtotalCents - savings)}</span>
      </div>

      {eligible > 0 && !open && !accepted && (
        <div className="mt-5 rounded-[18px] bg-accent-soft p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-success">
            <FileText size={16} aria-hidden /> {eligible > 1 ? `${eligible} lignes éligibles` : "1 ligne éligible"} au prix négocié
          </p>
          <p className="mt-1 text-ink-2">Proposez votre propre prix unitaire. Le service commercial accepte ou fait une contre-offre, généralement dans l&apos;heure.</p>
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {accepted ? (
          <Link href={`${BASE}/checkout`} className={btn("primary", "lg", "w-full")}>
            Commander au prix convenu <ArrowRight size={17} aria-hidden />
          </Link>
        ) : open ? (
          <>
            <Link href={`${BASE}/negotiation`} className={btn("trade", "lg", "w-full")}>
              {quote?.status === "awaiting_customer" ? "Répondre à la contre-offre" : "Voir votre devis"}
            </Link>
            <p className="text-center text-[13px] text-ink-3">La commande sera possible une fois le devis convenu ou annulé.</p>
          </>
        ) : (
          <>
            {eligible > 0 && (
              <Link href={`${BASE}/negotiation`} className={btn("trade", "lg", "w-full")}>
                Demander un prix négocié
              </Link>
            )}
            <Link href={`${BASE}/checkout`} className={btn(eligible ? "outline" : "primary", "lg", "w-full")}>
              {eligible ? "Commander au prix catalogue" : "Passer la commande"}
            </Link>
          </>
        )}
      </div>
      <p className="mt-5 flex items-center gap-2 text-[13px] text-ink-3">
        <Truck size={15} className="shrink-0" aria-hidden /> Expédition le lendemain pour toute commande passée avant 14 h
      </p>
    </div>
  );
}

/** The cart: quantities, trade eligibility, the quote lock, and the way on to a quote or checkout. */
export function CartScreen() {
  const cart = useCart();
  const quote = useNegotiation(cart.data?.lockedByNegotiationId ?? null);
  const short = useShortLines();
  const c = cart.data;
  const lines = c?.items ?? [];
  const locked = !!c?.lockedByNegotiationId;
  const accepted = quote.data?.status === "accepted";
  const items = lines.reduce((t, l) => t + l.quantity, 0);

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-16 lg:px-6 lg:pb-6">
      <PageHeader
        crumbs={[{ label: "Accueil", href: BASE || "/" }, { label: "Panier" }]}
        title="Votre panier"
        lead={
          c
            ? lines.length
              ? `${formatCount(lines.length)} ${lines.length === 1 ? "ligne" : "lignes"} · ${formatCount(items)} ${items === 1 ? "article" : "articles"}`
              : "Votre panier ne contient encore aucun article."
            : undefined
        }
        aside={lines.length > 0 ? <ActionLink href={`${BASE}/category/power-tools`}>Continuer mes achats</ActionLink> : undefined}
      />

      {cart.isPending ? (
        <div className={`${TILE} mt-6 flex items-center justify-center gap-3 p-12 text-ink-3`} aria-busy="true">
          <Spinner /> Chargement de votre panier…
        </div>
      ) : cart.isError ? (
        <ErrorTile className="mt-6" message={errorMessage(cart.error)} onRetry={() => void cart.refetch()} />
      ) : lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-4">
          <div className="min-w-0 space-y-3">
            {locked && (
              <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-dark p-5 text-on-dark" role="status">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10">
                  <Lock size={18} aria-hidden />
                </span>
                <p className="min-w-0 flex-1">
                  <span className="font-semibold">Quantités verrouillées</span>
                  <span className="block text-sm text-on-dark-2">
                    {accepted
                      ? "Votre prix convenu s'applique à ces quantités. Passez la commande ou annulez le devis pour les modifier."
                      : "Votre devis est en cours auprès du service commercial. Annulez-le pour modifier votre panier."}
                  </span>
                </p>
                <Link href={`${BASE}/negotiation`} className={btn("light", "md")}>
                  Voir le devis
                </Link>
              </div>
            )}
            <ul className="space-y-3" aria-label="Lignes du panier">
              {lines.map((l) => (
                <CartLine key={l.productId} line={l} locked={locked} available={short[l.productId]} />
              ))}
            </ul>
          </div>

          <aside className="lg:sticky lg:top-[96px] lg:self-start" aria-label="Récapitulatif du panier">
            <Summary subtotalCents={c?.subtotalCents ?? 0} eligible={lines.filter((l) => l.negotiationEligible).length} quote={quote.data} />
          </aside>
        </div>
      )}
    </div>
  );
}
