"use client";

import { ArrowRight, ArrowUpRight, Hammer, Package, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCategories, useMe, useOrders, useProducts } from "@/core/api/client/react";
import type { CategoryNode } from "@/core/contract";
import { ActionLink, BASE, ErrorTile, ORDER_STATUS_LABEL, OrderStatusChip, ProductImage, SectionHead, TILE, btn, errorMessage, formatCount, formatDate, formatMoney } from "@/core/ui";
import { ProductGrid } from "./product-card";

/** "1 produit", "12 produits" (French: plural from 2). */
const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n > 1 ? "s" : ""}`;
/** "1 produit professionnel", "12 produits professionnels". */
const proProducts = (n: number) => `${formatCount(n)} ${n > 1 ? "produits professionnels" : "produit professionnel"}`;

const MONO = "font-[family-name:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace]";
const PEGBOARD = "#e3e9f2";

/* ---------- Hero · Pinboard ---------- */

/** A photo pinned to the board: white print border, slight rotation, a strip of green tape. */
function Pinned({ src, className, rotate, tape = "left", priority = false }: { src?: string; className: string; rotate: string; tape?: "left" | "right"; priority?: boolean }) {
  return (
    <figure className={`absolute bg-surface p-2.5 pb-3 shadow-[0_18px_40px_-20px_rgb(6_22_61/0.55)] ${className}`} style={{ transform: `rotate(${rotate})` }}>
      {src ? <ProductImage src={src} alt="" priority={priority} className="aspect-[14/11] w-full object-cover" /> : <div className="shimmer aspect-[14/11] w-full" />}
      <span className={`absolute -top-3 h-6 w-20 ${tape === "left" ? "left-6 -rotate-6" : "right-6 rotate-6"}`} style={{ background: "rgb(53 179 53 / 0.82)" }} aria-hidden />
    </figure>
  );
}

function Hero({ company, firstName, newCustomer, productCount, photos, shopHref }: { company?: string; firstName?: string; newCustomer: boolean; productCount?: number; photos: (string | undefined)[]; shopHref: string }) {
  return (
    <section className="grid gap-10 px-1 pb-2 pt-4 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pt-10" aria-labelledby="hero-title">
      <div className="flex flex-col justify-center">
        <div className="hero-in flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={`${MONO} inline-flex items-center rounded-[6px] border-2 border-success px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-success`}>
            Compte pro{company ? ` · ${company}` : ""}
          </span>
          <span className="text-[14px] text-ink-3">{newCustomer || !firstName ? "Bienvenue chez SOCIMCO" : `Ravis de vous revoir, ${firstName}`}</span>
        </div>
        <h1 id="hero-title" className="display hero-in mt-5 text-[46px] leading-[0.95] text-ink [animation-delay:80ms] sm:text-[64px] lg:text-[84px]" style={{ fontWeight: 800, letterSpacing: "-0.045em" }}>
          Le bon outil.
          <br />
          Le juste prix.
          <br />
          <span className="relative isolate inline-block">
            <span className="absolute -inset-x-2 bottom-[0.06em] top-[0.46em] -z-10 -rotate-1 rounded-[6px] bg-accent" aria-hidden />
            En volume.
          </span>
        </h1>
        <p className="hero-in mt-6 max-w-[500px] text-[16px] leading-relaxed text-ink-3 [animation-delay:160ms] lg:text-[18px]">
          {productCount !== undefined ? proProducts(productCount) : "Des produits professionnels"} au service des équipes de chantier. Commandez en volume et proposez votre propre prix unitaire au moment de la commande.
        </p>
        <div className="hero-in mt-8 flex flex-wrap gap-3 [animation-delay:240ms]">
          <Link href={shopHref} className={btn("primary", "lg")}>
            Voir le catalogue <ArrowRight size={18} aria-hidden />
          </Link>
          <a href="#how-quotes-work" className={btn("outline", "lg")}>
            Fonctionnement des devis
          </a>
        </div>
        <ul className={`${MONO} hero-in mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.12em] text-ink-3 [animation-delay:300ms]`}>
          <li className="flex items-center gap-2">
            <Truck size={15} aria-hidden /> Livraison J+1 avant 14 h
          </li>
          <li className="flex items-center gap-2">
            <Hammer size={15} aria-hidden /> Testé par les pros
          </li>
        </ul>
      </div>

      {/* Pinboard collage on a pegboard */}
      <div className="hero-in relative h-[360px] sm:h-[460px] lg:h-[540px] [animation-delay:200ms]">
        <div
          className="absolute inset-0 rounded-[28px]"
          style={{ backgroundColor: PEGBOARD, backgroundImage: "radial-gradient(rgb(6 22 61 / 0.13) 1.6px, transparent 1.8px)", backgroundSize: "22px 22px", backgroundPosition: "11px 11px" }}
          aria-hidden
        />
        <Pinned src={photos[0]} className="left-[6%] top-[8%] w-[58%]" rotate="-3deg" priority />
        <Pinned src={photos[1]} className="right-[5%] top-[18%] w-[44%]" rotate="4deg" tape="right" priority />
        <Pinned src={photos[2]} className="bottom-[7%] left-[22%] w-[40%] max-sm:hidden" rotate="-1.5deg" />
        {/* Hanging trade tag */}
        <Link
          href={`${BASE}/negotiation`}
          className="absolute bottom-[10%] right-[6%] rotate-[-4deg] drop-shadow-[0_10px_18px_rgb(6_22_61/0.35)] transition-transform duration-300 hover:rotate-[-2deg] motion-reduce:transition-none"
        >
          <span className="block bg-accent py-3 pl-6 pr-4 text-accent-ink [clip-path:polygon(10px_0,100%_0,100%_100%,10px_100%,0_50%)]">
            <span className={`${MONO} block text-[11px] uppercase tracking-[0.16em]`}>Négociable dès 100</span>
            <span className="display block text-[20px] leading-tight" style={{ fontWeight: 800 }}>
              Proposez votre prix
            </span>
          </span>
          <span className="absolute left-[3px] top-1/2 size-2.5 -translate-y-1/2 rounded-full ring-2 ring-dark" style={{ backgroundColor: PEGBOARD }} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---------- Volume-ready ---------- */

function VolumeReady({ departments, allHref }: { departments: CategoryNode[]; allHref: string }) {
  const [cat, setCat] = useState("all");
  const products = useProducts(cat === "all" ? {} : { category: cat });
  const picks = (products.data?.items ?? []).filter((p) => p.negotiable).slice(0, 8);
  const loading = products.isPending || (products.isPlaceholderData && products.isFetching);

  return (
    <section className="mt-10 lg:mt-14" aria-labelledby="volume-ready">
      <div id="volume-ready">
        <SectionHead title="Spécial volume" sub="Commandez la quantité indiquée sur l'étiquette et proposez votre prix au moment de la commande." action={{ label: "Tout voir", href: allHref }} />
      </div>
      <div className="-mx-3 mt-5 flex gap-2 overflow-x-auto px-3 pb-1 lg:mx-0 lg:px-0" role="group" aria-label="Filtrer par rayon">
        {[{ slug: "all", name: "Tous" }, ...departments].map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => setCat(c.slug)}
            aria-pressed={cat === c.slug}
            className={`h-11 shrink-0 rounded-full px-4 text-[14px] font-medium ${cat === c.slug ? "bg-dark text-on-dark" : "bg-surface text-ink hover:bg-surface-2"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {products.isError ? (
          <ErrorTile message={errorMessage(products.error)} onRetry={() => void products.refetch()} />
        ) : !loading && picks.length === 0 ? (
          <p className={`${TILE} p-8 text-center text-ink-2`}>Aucun produit négociable dans ce rayon pour le moment.</p>
        ) : (
          <ProductGrid items={picks} loading={loading} className="grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" />
        )}
      </div>
    </section>
  );
}

/* ---------- Departments bento ---------- */

function DepartmentTile({ c, className }: { c: CategoryNode; className: string }) {
  return (
    <Link href={`${BASE}/category/${c.slug}`} className={`group relative overflow-hidden rounded-[24px] bg-dark ${className}`}>
      <ProductImage src={c.imageUrl} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105 motion-reduce:transition-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
        <div className="min-w-0">
          <p className="display text-[19px] leading-tight lg:text-[22px]">{c.name}</p>
          <p className="text-[13px] text-white/85">{plural(c.productCount, "produit")}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/90 text-ink transition group-hover:bg-white" aria-hidden>
          <ArrowUpRight size={17} />
        </span>
      </div>
    </Link>
  );
}

function Departments({ departments, productCount }: { departments: CategoryNode[]; productCount?: number }) {
  const [c1, c2, c3, c4, c5, ...rest] = departments;
  const sizes = ["col-span-2 min-h-[220px] lg:col-span-2 lg:row-span-2 lg:min-h-[440px]", "min-h-[170px] lg:min-h-0", "min-h-[170px] lg:min-h-0", "min-h-[170px] lg:min-h-[212px]", "min-h-[170px] lg:min-h-[212px]"];
  const lead = [c1, c2, c3, c4, c5].filter((c): c is CategoryNode => Boolean(c));
  return (
    <section className="mt-12 lg:mt-16">
      <SectionHead title="Rayons" sub={`${plural(departments.length, "rayon")}${productCount !== undefined ? `, ${proProducts(productCount)}` : ""}.`} />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-2 lg:gap-4">
        {lead.map((c, i) => (
          <DepartmentTile key={c.id} c={c} className={sizes[i]} />
        ))}
      </div>
      {rest.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:mt-4 lg:gap-4">
          {rest.map((c, i) => (
            <DepartmentTile key={c.id} c={c} className={`block min-h-[150px] ${rest.length % 2 === 1 && i === rest.length - 1 ? "sm:col-span-2" : ""}`} />
          ))}
        </div>
      )}
    </section>
  );
}

function DepartmentsSkeleton() {
  return (
    <section className="mt-12 lg:mt-16" aria-hidden>
      <div className="shimmer h-8 w-48 rounded-full" />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-2 lg:gap-4">
        <div className="shimmer col-span-2 min-h-[220px] rounded-[24px] lg:row-span-2 lg:min-h-[440px]" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer min-h-[170px] rounded-[24px] lg:min-h-[212px]" />
        ))}
      </div>
    </section>
  );
}

/* ---------- Recent orders + how quotes work ---------- */

function OrdersAndHow() {
  const orders = useOrders(3);
  const items = orders.data?.items ?? [];
  const newCustomer = orders.isSuccess && items.length === 0;

  return (
    <section className="mt-12 grid gap-3 lg:mt-16 lg:grid-cols-12 lg:gap-4">
      <div className="rounded-[28px] bg-surface p-6 lg:col-span-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-[22px]">Vos commandes</h2>
          {!newCustomer && <ActionLink href={`${BASE}/orders`}>Tout voir</ActionLink>}
        </div>
        {orders.isPending ? (
          <div className="mt-4 space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-14 rounded-[16px]" />
            ))}
          </div>
        ) : orders.isError ? (
          <ErrorTile message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} className="mt-4 bg-surface-2" />
        ) : newCustomer ? (
          <div className="mt-4 rounded-[20px] bg-surface-2 p-8 text-center">
            <Package size={26} className="mx-auto text-ink-3" aria-hidden />
            <p className="mt-3 font-semibold">Aucune commande pour le moment</p>
            <p className="mt-1 text-ink-2">Vos commandes et le suivi de leur livraison apparaîtront ici.</p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-canvas">
            {items.map((o) => (
              <li key={o.id}>
                <Link href={`${BASE}/orders/${o.id}`} className="-mx-3 grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-[16px] px-3 py-4 hover:bg-surface-2 sm:grid-cols-[1fr_auto_auto]">
                  <div className="min-w-0">
                    <p className="tabular font-semibold">
                      {o.number}
                      {o.negotiated && (
                        <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-dark px-2 py-0.5 align-middle text-[11px] font-semibold text-on-dark">
                          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                          Prix négocié
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] text-ink-3">
                      {formatDate(o.createdAt)} · {plural(o.itemCount, "article")}
                      {o.savingsCents > 0 && <span className="ml-2 font-medium text-success">Économie : {formatMoney(o.savingsCents)}</span>}
                    </p>
                  </div>
                  <span className="hidden sm:block">
                    <OrderStatusChip status={o.status} />
                  </span>
                  <div className="text-right">
                    <p className="tabular font-semibold">{formatMoney(o.totalCents)}</p>
                    <p className="text-[13px] text-ink-3 sm:hidden">{ORDER_STATUS_LABEL[o.status] ?? o.status}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div id="how-quotes-work" className="scroll-mt-24 rounded-[28px] bg-dark p-6 text-on-dark lg:col-span-5">
        <h2 className="display text-[22px]">Comment fonctionnent les devis</h2>
        <ol className="mt-5 space-y-4">
          {["Ajoutez au moins 100 unités d'un produit négociable", "Proposez un prix unitaire : jusqu'à 3 offres", "Une fois le prix convenu, commandez sous 24 heures"].map((s, i) => (
            <li key={s} className="flex gap-4">
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-bold ${i === 0 ? "bg-accent text-accent-ink" : "bg-surface text-ink"}`}>{i + 1}</span>
              <span className="pt-1 text-[15px] text-on-dark/85">{s}</span>
            </li>
          ))}
        </ol>
        <Link href={`${BASE}/negotiation`} className={btn("trade", "md", "mt-6")}>
          Demander un prix négocié <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---------- Page ---------- */

export function Home() {
  const me = useMe();
  const categories = useCategories();
  const all = useProducts({});
  const orders = useOrders(3);

  const user = me.data?.user;
  const departments = categories.data?.categories ?? [];
  const productCount = all.data?.total;
  const shopHref = departments[0] ? `${BASE}/category/${departments[0].slug}` : BASE || "/";
  const newCustomer = orders.isSuccess && orders.data.items.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-10 pt-3 lg:px-6 lg:pb-6 lg:pt-6">
      <Hero
        company={user?.company}
        firstName={user?.name.split(" ")[0]}
        newCustomer={newCustomer}
        productCount={productCount}
        photos={[departments[0]?.imageUrl, departments[1]?.imageUrl, departments[2]?.imageUrl]}
        shopHref={shopHref}
      />
      <VolumeReady departments={departments} allHref={shopHref} />
      {categories.isPending ? (
        <DepartmentsSkeleton />
      ) : categories.isError ? (
        <div className="mt-12 lg:mt-16">
          <ErrorTile message={errorMessage(categories.error)} onRetry={() => void categories.refetch()} />
        </div>
      ) : (
        <Departments departments={departments} productCount={productCount} />
      )}
      <OrdersAndHow />
    </div>
  );
}
