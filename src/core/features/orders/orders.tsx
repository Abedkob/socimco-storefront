"use client";

import { ArrowRight, ChevronRight, FileText, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useOrders } from "@/core/api/client/react";
import type { OrderSummary } from "@/core/contract";
import { ActionLink, BASE, btn, ErrorTile, errorMessage, formatCount, formatDate, formatMoney, formatMoneyShort, NegotiatedChip, OrderStatusChip, PageHeader, TILE } from "@/core/ui";

const SHOP_AGAIN = `${BASE}/category/power-tools`;

function OrderRow({ o }: { o: OrderSummary }) {
  return (
    <li>
      <Link
        href={`${BASE}/orders/${encodeURIComponent(o.id)}`}
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[20px] p-3 transition-colors hover:bg-surface-2 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:gap-x-5 sm:px-4"
      >
        {/* The order list has no line images, so the mark shows what kind of order it is instead. */}
        <span className={`grid size-12 place-items-center rounded-[14px] ${o.negotiated ? "bg-dark text-accent" : "bg-surface-2 text-ink-2"}`} aria-hidden>
          {o.negotiated ? <FileText size={20} /> : <Package size={20} />}
        </span>
        <span className="min-w-0">
          <span className="tabular flex flex-wrap items-center gap-2 font-semibold">
            {o.number}
            {o.negotiated && <NegotiatedChip />}
          </span>
          <span className="block text-sm text-ink-3 sm:truncate">
            {formatDate(o.createdAt)} · {formatCount(o.itemCount)} {o.itemCount === 1 ? "article" : "articles"}
          </span>
        </span>
        <span className="hidden sm:block">
          <OrderStatusChip status={o.status} />
        </span>
        <span className="tabular text-right">
          <span className="block font-semibold">{formatMoney(o.totalCents)}</span>
          {o.savingsCents > 0 && <span className="block text-[13px] font-medium text-success">Économie de {formatMoney(o.savingsCents)}</span>}
        </span>
        <ChevronRight size={18} className="hidden text-ink-3 transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
        <span className="col-start-2 sm:hidden">
          <OrderStatusChip status={o.status} />
        </span>
      </Link>
    </li>
  );
}

export function OrdersScreen() {
  const orders = useOrders();
  const [filter, setFilter] = useState<"all" | "negotiated">("all");
  const list = orders.data?.items ?? [];
  const loading = orders.isPending;
  const negotiatedCount = list.filter((o) => o.negotiated).length;
  const shown = filter === "negotiated" ? list.filter((o) => o.negotiated) : list;
  const saved = list.reduce((t, o) => t + o.savingsCents, 0);
  const spent = list.reduce((t, o) => t + o.totalCents, 0);
  const latest = list[0];
  const empty = orders.isSuccess && list.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-16 lg:px-6 lg:pb-6">
      <PageHeader
        crumbs={[{ label: "Accueil", href: BASE || "/" }, { label: "Compte", href: `${BASE}/account` }, { label: "Commandes" }]}
        title="Commandes"
        lead="Toutes les commandes de votre compte professionnel, des plus récentes aux plus anciennes."
        aside={<ActionLink href={SHOP_AGAIN}>Continuer vos achats</ActionLink>}
      />

      {!empty && !orders.isError && (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            ["Commandes", loading ? "—" : formatCount(list.length), "sur ce compte"],
            ["Dépensé", loading ? "—" : formatMoneyShort(spent), "après économies négociées"],
            ["Économies sur devis", loading ? "—" : formatMoneyShort(saved), "négociées sur le volume"],
            ["Dernière commande", loading || !latest ? "—" : latest.number, latest ? formatDate(latest.createdAt) : ""],
          ].map(([k, v, sub], i) => (
            <div key={k} className={`min-w-0 rounded-[var(--radius-card)] p-5 ${i === 2 ? "bg-dark text-on-dark" : "bg-surface"}`}>
              <p className={`text-[13px] ${i === 2 ? "text-on-dark-2" : "text-ink-3"}`}>{k}</p>
              {/* French amounts are long ("102 000 $US"): smaller on phones, and wrap rather than cut off. */}
              <p className={`tabular display mt-1 text-[19px] leading-tight [overflow-wrap:anywhere] min-[400px]:text-[22px] sm:text-[24px] lg:text-[28px] ${i === 2 ? "text-[#9fd8b7]" : ""}`}>{v}</p>
              <p className={`mt-0.5 text-[12px] ${i === 2 ? "text-on-dark-2" : "text-ink-3"}`}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {orders.isError ? (
        <ErrorTile message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} className="mt-6" />
      ) : (
        <section className={`${TILE} mt-3 p-3 lg:mt-4 lg:p-4`} aria-label="Historique des commandes">
          {loading ? (
            <ul className="space-y-2 p-1" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="shimmer h-[72px] rounded-[20px]" />
              ))}
            </ul>
          ) : empty ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-surface-2">
                <Package size={24} aria-hidden />
              </span>
              <h2 className="display mt-4 text-[26px]">Aucune commande pour le moment</h2>
              <p className="mt-1 max-w-sm text-ink-2">Vos commandes, vos livraisons et vos économies négociées apparaîtront ici.</p>
              <Link href={SHOP_AGAIN} className={btn("primary", "lg", "mt-6")}>
                Commencer vos achats <ArrowRight size={17} aria-hidden />
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 pt-1">
                <div className="flex gap-1.5" role="group" aria-label="Filtrer les commandes">
                  {(["all", "negotiated"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                      className="h-11 rounded-full px-4 text-sm font-medium capitalize text-ink-2 ring-1 ring-inset ring-line hover:bg-surface-2 aria-pressed:bg-dark aria-pressed:text-on-dark aria-pressed:ring-dark sm:h-10"
                    >
                      {f === "all" ? `Toutes · ${formatCount(list.length)}` : `Négociées · ${formatCount(negotiatedCount)}`}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-ink-3">Touchez une commande pour voir le détail, les économies et la livraison.</p>
              </div>
              {shown.length === 0 ? (
                <p className="px-4 py-10 text-center text-ink-3">Aucune commande négociée pour le moment. Les commandes passées à un prix négocié apparaîtront ici.</p>
              ) : (
                <ul className="divide-y divide-canvas">
                  {shown.map((o) => (
                    <OrderRow key={o.id} o={o} />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
