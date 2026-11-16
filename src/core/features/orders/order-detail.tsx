"use client";

import { Check, FileText, MapPin, PackageSearch, RotateCcw, Truck } from "lucide-react";
import Link from "next/link";
import { useOrder } from "@/core/api/client/react";
import { isApiError, type Order } from "@/core/contract";
import {
  BASE,
  btn,
  ErrorTile,
  errorMessage,
  Eyebrow,
  formatCount,
  formatDate,
  formatMoney,
  NegotiatedChip,
  ORDER_STATUS_LABEL,
  OrderStatusChip,
  PageHeader,
  ProductImage,
  ProposalTag,
  proposalMessage,
  TILE,
  useToast,
} from "@/core/ui";

const STEPS = ["confirmed", "processing", "shipped", "delivered"] as const;
const PAGE = "mx-auto max-w-[1400px] px-3 pb-16 lg:px-6 lg:pb-6";
const HOME = BASE || "/";

const itemsOf = (o: Order) => o.lines.reduce((t, l) => t + l.quantity, 0);
/** "neg_8f3a…" → "Q-8f3a…", the reference the sales desk uses. */
const quoteRef = (id: string) => id.replace(/^neg_/, "Q-");

function NotFound() {
  return (
    <div className={PAGE}>
      <PageHeader crumbs={[{ label: "Accueil", href: HOME }, { label: "Commandes", href: `${BASE}/orders` }, { label: "Introuvable" }]} title="Commande introuvable" />
      <div className={`${TILE} mt-6 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center`}>
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-surface-2">
          <PackageSearch size={24} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-ink-2">Nous n&apos;avons pas trouvé cette commande sur votre compte. Elle appartient peut-être à un autre compte, ou le lien est incomplet.</p>
        <Link href={`${BASE}/orders`} className={btn("primary", "lg")}>
          Toutes les commandes
        </Link>
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className={PAGE} aria-busy="true">
      <div className="px-1 pt-4">
        <div className="shimmer h-11 w-48 rounded-full" />
        <div className="shimmer mt-2 h-12 w-72 max-w-full rounded-[14px]" />
      </div>
      <div className="shimmer mt-6 h-[92px] rounded-[var(--radius-card)]" />
      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-4">
        <div className="shimmer h-[320px] rounded-[var(--radius-card)]" />
        <div className="shimmer h-[320px] rounded-[var(--radius-card)]" />
      </div>
      <span className="sr-only">Chargement de la commande…</span>
    </div>
  );
}

export function OrderDetailScreen({ id }: { id: string }) {
  const query = useOrder(id);
  const { notify } = useToast();

  if (query.isPending) return <OrderDetailSkeleton />;
  if (isApiError(query.error) && query.error.code === "NOT_FOUND") return <NotFound />;
  if (query.isError) {
    return (
      <div className={PAGE}>
        <PageHeader crumbs={[{ label: "Accueil", href: HOME }, { label: "Commandes", href: `${BASE}/orders` }, { label: "Commande" }]} title="Commande" />
        <ErrorTile message={errorMessage(query.error)} onRetry={() => void query.refetch()} className="mt-6" />
      </div>
    );
  }

  const o = query.data.order;
  const step = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const negotiated = o.lines.some((l) => l.negotiated);
  const items = itemsOf(o);

  return (
    <div className={PAGE}>
      <PageHeader
        crumbs={[{ label: "Accueil", href: HOME }, { label: "Commandes", href: `${BASE}/orders` }, { label: o.number }]}
        title={<span className="tabular">{o.number}</span>}
        lead={`Passée le ${formatDate(o.createdAt)} · ${formatCount(items)} ${items === 1 ? "article" : "articles"}${negotiated ? " · avec un prix négocié" : ""}`}
        aside={<OrderStatusChip status={o.status} />}
      />

      {o.status !== "cancelled" && (
        <section className={`${TILE} mt-6 p-5 lg:p-6`} aria-label="Suivi de la commande">
          <ol className="grid grid-cols-4 gap-2">
            {STEPS.map((name, i) => {
              const done = i <= step;
              return (
                <li key={name} className="min-w-0" aria-current={i === step ? "step" : undefined}>
                  <div className={`h-1.5 rounded-full ${done ? (i === step ? "bg-accent" : "bg-dark") : "bg-surface-2"}`} />
                  <p className={`mt-2 flex items-start gap-1.5 text-[12px] leading-tight min-[400px]:text-[13px] sm:text-sm ${done ? "font-semibold text-ink" : "text-ink-3"}`}>
                    {done && <Check size={14} className="mt-px hidden shrink-0 sm:block" aria-hidden />}
                    {/* Wraps on narrow phones (« En préparation ») instead of being cut off. */}
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {ORDER_STATUS_LABEL[name]}
                    </span>
                  </p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:mt-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-4">
        <section className={`${TILE} p-6 lg:self-start`} aria-labelledby="lines-h">
          <h2 id="lines-h" className="display text-[22px]">
            Articles
          </h2>
          <ul className="mt-4 divide-y divide-canvas">
            {o.lines.map((l) => {
              const save = (l.listUnitPriceCents - l.unitPriceCents) * l.quantity;
              return (
                <li key={l.productId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <ProductImage src={l.imageUrl} alt="" className="size-16 shrink-0 rounded-[14px] bg-surface-2 object-cover sm:size-20" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{l.name}</p>
                      {l.negotiated && <NegotiatedChip />}
                    </div>
                    <p className="tabular text-[13px] text-ink-3">{l.sku}</p>
                    <p className="tabular mt-1 text-sm text-ink-2">
                      {formatCount(l.quantity)} × {l.negotiated && l.listUnitPriceCents !== l.unitPriceCents && <span className="mr-1 text-ink-3 line-through">{formatMoney(l.listUnitPriceCents)}</span>}
                      <span className="font-semibold text-ink">{formatMoney(l.unitPriceCents)}</span>
                    </p>
                    {save > 0 && <p className="tabular text-sm font-semibold text-success">Économie de {formatMoney(save)}</p>}
                  </div>
                  <p className="tabular shrink-0 font-semibold">{formatMoney(l.unitPriceCents * l.quantity)}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-3 lg:space-y-4">
          <section className={`${TILE} p-6`} aria-labelledby="totals-h">
            <Eyebrow>
              <span id="totals-h">Récapitulatif</span>
            </Eyebrow>
            <dl className="tabular mt-3 space-y-2 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Sous-total au prix catalogue</dt>
                <dd>{formatMoney(o.subtotalCents)}</dd>
              </div>
              {o.discountCents > 0 && (
                <div className="flex justify-between gap-4 text-success">
                  <dt>Économies négociées</dt>
                  <dd className="font-semibold">−{formatMoney(o.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Livraison</dt>
                <dd>{o.shippingCents === 0 ? "Offerte" : formatMoney(o.shippingCents)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-2">Taxes</dt>
                <dd>{formatMoney(o.taxCents)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-canvas pt-4">
              <span className="font-semibold">Total payé</span>
              <span className="tabular display text-[30px] leading-none">{formatMoney(o.totalCents)}</span>
            </div>
          </section>

          <section className={`${TILE} p-6`} aria-labelledby="ship-h">
            <Eyebrow>
              <span id="ship-h">{o.status === "delivered" ? "Livrée à" : "Livraison à"}</span>
            </Eyebrow>
            <p className="mt-3 flex gap-3 leading-relaxed">
              <MapPin size={18} className="mt-1 shrink-0 text-success" aria-hidden />
              <span>
                <span className="font-semibold">{o.shippingAddress.label}</span>
                <br />
                {o.shippingAddress.line1}, {o.shippingAddress.city} {o.shippingAddress.postalCode}, {o.shippingAddress.country}
              </span>
            </p>
            <p className="mt-3 flex items-center gap-3 text-sm text-ink-2">
              <Truck size={18} className="shrink-0 text-ink-3" aria-hidden /> Livraison professionnelle standard
            </p>
          </section>

          {o.negotiationId && (
            <section className="rounded-[var(--radius-card)] bg-dark p-6 text-on-dark" aria-label="Devis">
              <p className="flex items-center gap-2 font-semibold">
                <FileText size={17} aria-hidden /> Prix convenu dans le devis <span className="tabular">{quoteRef(o.negotiationId)}</span>
              </p>
              <p className="mt-1 text-sm text-on-dark-2">Cette commande utilise un prix que vous avez négocié avec le service commercial SOCIMCO.</p>
            </section>
          )}

          <button type="button" onClick={() => notify(proposalMessage("La commande à l'identique"), "info")} className={btn("outline", "lg", "w-full")}>
            <RotateCcw size={17} aria-hidden /> Commander à nouveau <ProposalTag />
          </button>
        </aside>
      </div>
    </div>
  );
}
