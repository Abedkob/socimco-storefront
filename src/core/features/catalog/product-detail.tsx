"use client";

import { Check, ChevronRight, FileText, PackageX, Star } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useCart, useCartMutations, useCategories, useProduct, useProducts } from "@/core/api/client/react";
import { isApiError, isNegotiationEligible, type CategoryNode, type Product } from "@/core/contract";
import { BASE, ErrorTile, PageHeader, ProductImage, SectionHead, StockLine, Stepper, TILE, TradeBadge, btn, errorMessage, formatCount, formatMoney, unitLabel, useToast } from "@/core/ui";
import { ProductGrid } from "./product-card";

/* ---------- Gallery ---------- */

function Gallery({ product }: { product: Product }) {
  const photos = product.images;
  const [active, setActive] = useState(0);
  const badge = product.negotiable && product.minNegotiableQty ? product.minNegotiableQty : null;
  return (
    <div className="min-w-0 rounded-[28px] bg-surface p-2.5">
      <div className="relative hidden overflow-hidden rounded-[22px] bg-canvas lg:block">
        <ProductImage src={photos[active] ?? photos[0]} alt={product.name} priority className="aspect-[4/3] w-full object-cover" />
        {badge && <TradeBadge qty={badge} className="absolute left-4 top-4 px-3 py-1.5 text-[12px]" />}
      </div>
      {photos.length > 1 && (
        <ul className="mt-2.5 hidden gap-2.5 lg:flex" aria-label="Images du produit">
          {photos.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Afficher l'image ${i + 1} sur ${photos.length}`}
                aria-current={active === i || undefined}
                className={`block overflow-hidden rounded-[16px] ring-2 ring-offset-2 ${active === i ? "ring-ink" : "ring-transparent hover:ring-line-strong"}`}
              >
                <ProductImage src={src} alt="" className="h-[72px] w-24 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Mobile: swipeable gallery */}
      <div className="relative lg:hidden">
        <ul className="flex snap-x snap-mandatory overflow-x-auto rounded-[22px] bg-canvas" aria-label="Images du produit">
          {photos.map((src, i) => (
            <li key={src} className="w-full shrink-0 snap-center">
              <ProductImage src={src} alt={`${product.name}, image ${i + 1} sur ${photos.length}`} priority={i === 0} className="aspect-[4/3] w-full object-cover" />
            </li>
          ))}
        </ul>
        {badge && <TradeBadge qty={badge} className="absolute left-3 top-3" />}
      </div>
      {photos.length > 1 && <p className="pb-1 pt-2 text-center text-sm text-ink-3 lg:hidden">Faites glisser pour voir les {photos.length} images</p>}
    </div>
  );
}

/* ---------- Helpers ---------- */

function findPlace(categories: CategoryNode[], id: string) {
  for (const node of categories) {
    if (node.id === id) return { category: node, parent: undefined };
    const child = node.children.find((c) => c.id === id);
    if (child) return { category: child, parent: node };
  }
  return { category: undefined, parent: undefined };
}

function initialQty(p: Product) {
  const max = Math.max(p.minOrderQty, p.stock);
  const wanted = p.negotiable && p.minNegotiableQty ? Math.min(p.stock || 1, p.minNegotiableQty * 4) : p.minOrderQty;
  return Math.min(max, Math.max(p.minOrderQty, wanted));
}

function Related({ product, categorySlug, categoryName }: { product: Product; categorySlug: string; categoryName: string }) {
  const res = useProducts({ category: categorySlug });
  const related = (res.data?.items ?? []).filter((p) => p.id !== product.id).slice(0, 4);
  if (res.isError || (res.isSuccess && related.length === 0)) return null;
  return (
    <section className="mt-12 lg:mt-16">
      <SectionHead title="Dans la même gamme" sub={categoryName} action={{ label: "Tout voir", href: `${BASE}/category/${categorySlug}` }} />
      <div className="mt-5">
        <ProductGrid items={related} loading={res.isPending} skeletons={4} className="grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" />
      </div>
    </section>
  );
}

/* ---------- Buy box + page ---------- */

function ProductView({ product }: { product: Product }) {
  const categories = useCategories();
  const cart = useCart();
  const { add } = useCartMutations();
  const { notify } = useToast();
  const [qty, setQty] = useState(() => initialQty(product));
  const [added, setAdded] = useState(false);

  const { category, parent } = findPlace(categories.data?.categories ?? [], product.categoryId);
  const range = parent ?? category;
  const soldOut = product.stock === 0;
  const maxQty = Math.max(product.minOrderQty, product.stock);
  const eligible = isNegotiationEligible(product, qty);
  const total = product.priceCents * qty;
  const inCart = cart.data?.items.find((l) => l.productId === product.id);

  const addToCart = () =>
    add.mutate(
      { productId: product.id, quantity: qty },
      {
        onSuccess: () => {
          setAdded(true);
          notify(`Ajouté au panier : ${formatCount(qty)} × ${product.name}`);
        },
        // The API's message covers CART_LOCKED (cart frozen by an open quote), stock and minimum-order errors.
        onError: (e) => notify(errorMessage(e), "danger"),
      },
    );

  const crumbs = [
    { label: "Accueil", href: BASE || "/" },
    ...[parent, category].filter((c): c is NonNullable<typeof c> => Boolean(c)).map((c) => ({ label: c.name, href: `${BASE}/category/${c.slug}` })),
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-36 lg:px-6 lg:pb-6">
      <nav aria-label="Fil d'Ariane" className="px-1 pt-4 text-sm text-ink-3">
        <ol className="flex flex-wrap items-center gap-x-1">
          {crumbs.map((c, i) => (
            <li key={c.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} aria-hidden />}
              <Link href={c.href} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
                {c.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-1 grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-4">
        <Gallery product={product} />

        <div className="min-w-0 rounded-[28px] bg-surface p-6 lg:self-start lg:p-8">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
            {product.brand} · <span className="tabular normal-case tracking-normal">Réf. {product.sku}</span>
          </p>
          <h1 className="display mt-2 text-[30px] leading-[1.06] sm:text-[38px]">{product.name}</h1>
          <div className="mt-3 flex items-center gap-2 text-sm text-ink-2">
            <span className="flex text-success" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={16} fill={i < Math.round(product.rating) ? "currentColor" : "none"} />
              ))}
            </span>
            <span>Note des professionnels : {product.rating.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/5</span>
          </div>

          <p className="tabular display mt-6 text-[44px] leading-none">
            {formatMoney(product.priceCents)}
            <span className="ml-2 font-sans text-base font-normal tracking-normal text-ink-3">/ {unitLabel(product.unit, 1)}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <StockLine stock={product.stock} />
            <span className="text-sm text-ink-3">Minimum de commande : {formatCount(product.minOrderQty)}</span>
          </div>

          {soldOut ? (
            <div className="mt-6 rounded-[20px] bg-surface-2 p-5" role="status">
              <p className="flex items-center gap-2 font-semibold">
                <PackageX size={18} aria-hidden /> Actuellement en rupture de stock
              </p>
              <p className="mt-1 text-sm text-ink-2">Ce produit pourra être ajouté au panier dès son réapprovisionnement.</p>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-canvas pt-6">
                <div>
                  <p className="mb-2 text-sm font-semibold" aria-hidden>
                    Quantité
                  </p>
                  <Stepper value={qty} min={product.minOrderQty} max={maxQty} onChange={setQty} label={`Quantité : ${product.name}`} className="w-[164px]" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-ink-3">Total de la ligne</p>
                  <p className="tabular display text-[28px] leading-tight" aria-live="polite">
                    {formatMoney(total)}
                  </p>
                </div>
              </div>

              {product.negotiable && product.minNegotiableQty ? (
                <div className={`mt-5 rounded-[20px] p-5 ${eligible ? "bg-dark text-on-dark" : "bg-surface-2"}`} aria-live="polite">
                  <p className="flex items-center gap-2 font-semibold">
                    {eligible ? (
                      <span className="grid size-6 place-items-center rounded-full bg-accent text-accent-ink">
                        <Check size={14} aria-hidden />
                      </span>
                    ) : (
                      <FileText size={18} aria-hidden />
                    )}
                    {eligible ? "Cette quantité ouvre droit à un prix négocié" : `Prix négocié dès ${formatCount(product.minNegotiableQty)} ${unitLabel(product.unit, product.minNegotiableQty)}`}
                  </p>
                  <div className={`mt-3 h-1.5 overflow-hidden rounded-full ${eligible ? "bg-dark-2" : "bg-line"}`} aria-hidden>
                    <div
                      className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${eligible ? "bg-accent" : "bg-dark"}`}
                      style={{ width: `${Math.min(100, (qty / product.minNegotiableQty) * 100)}%` }}
                    />
                  </div>
                  <p className={`mt-2 text-sm ${eligible ? "text-on-dark-2" : "text-ink-2"}`}>
                    {eligible ? "Ajoutez au panier, puis proposez votre prix unitaire lors de la commande." : `Ajoutez-en ${formatCount(product.minNegotiableQty - qty)} de plus pour demander un prix négocié.`}
                  </p>
                </div>
              ) : (
                <p className="mt-5 rounded-[20px] bg-surface-2 p-4 text-sm text-ink-2">Prix fixe : ce produit n&apos;est pas négociable.</p>
              )}

              <button
                type="button"
                onClick={addToCart}
                disabled={add.isPending}
                aria-busy={add.isPending || undefined}
                className={btn("primary", "lg", "tabular mt-5 hidden w-full lg:flex")}
              >
                Ajouter au panier · {formatMoney(total)}
              </button>
            </>
          )}
          {(added || inCart) && (
            <p className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-success-soft px-4 py-3 text-sm font-medium text-success" role="status">
              <span className="flex items-center gap-2">
                <Check size={16} aria-hidden /> Dans votre panier : {formatCount(inCart?.quantity ?? qty)}
              </span>
              <span className="flex flex-wrap gap-x-4">
                {inCart && isNegotiationEligible(product, inCart.quantity) && (
                  <Link href={`${BASE}/negotiation`} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
                    Demander un prix négocié
                  </Link>
                )}
                <Link href={`${BASE}/cart`} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
                  Voir le panier
                </Link>
              </span>
            </p>
          )}
        </div>
      </div>

      <section className="mt-3 grid gap-3 lg:mt-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-4">
        <div className="min-w-0 rounded-[28px] bg-surface p-6 lg:p-8">
          <h2 className="display text-[24px]">Caractéristiques</h2>
          <dl className="mt-3 divide-y divide-canvas">
            {[["Référence", product.sku], ["Marque", product.brand], ["Unité", unitLabel(product.unit, 1)], ...Object.entries(product.specs)].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-3">
                <dt className="text-ink-3">{k}</dt>
                <dd className="tabular break-words font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="min-w-0 rounded-[28px] bg-dark p-6 text-on-dark lg:p-8">
          <h2 className="display text-[24px]">À propos de ce produit</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-on-dark/80">{product.description}</p>
        </div>
      </section>

      {range && <Related product={product} categorySlug={range.slug} categoryName={range.name} />}

      {/* Mobile sticky buy bar, floating above the nav */}
      {!soldOut && (
        <div className="fixed inset-x-3 bottom-[88px] z-20 flex items-center gap-2 rounded-full bg-surface p-1.5 shadow-[0_12px_32px_-12px_rgb(6_22_61/0.45)] ring-1 ring-black/5 lg:hidden">
          <Stepper value={qty} min={product.minOrderQty} max={maxQty} onChange={setQty} size="sm" label={`Quantité : ${product.name} (barre d'achat)`} className="w-[128px] shrink-0" />
          <button type="button" onClick={addToCart} disabled={add.isPending} aria-busy={add.isPending || undefined} className={btn("primary", "md", "tabular min-w-0 flex-1 px-3")}>
            <span className="truncate">Ajouter · {formatMoney(total)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-36 lg:px-6 lg:pb-6" aria-busy="true">
      <div className="shimmer mt-6 h-4 w-48 rounded-full" />
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-4">
        <div className="rounded-[28px] bg-surface p-2.5">
          <div className="shimmer aspect-[4/3] rounded-[22px]" />
        </div>
        <div className="space-y-4 rounded-[28px] bg-surface p-6 lg:p-8">
          <div className="shimmer h-3 w-1/3 rounded-full" />
          <div className="shimmer h-9 w-5/6 rounded-full" />
          <div className="shimmer h-12 w-1/2 rounded-full" />
          <div className="shimmer h-24 w-full rounded-[20px]" />
          <div className="shimmer h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug ?? "");
  const res = useProduct(slug);

  if (res.isPending) return <ProductDetailSkeleton />;
  if (res.isError) {
    const notFound = isApiError(res.error) && res.error.code === "NOT_FOUND";
    return (
      <div className="mx-auto max-w-[1400px] px-3 pb-14 lg:px-6">
        <PageHeader crumbs={[{ label: "Accueil", href: BASE || "/" }, { label: notFound ? "Introuvable" : "Produit" }]} title={notFound ? "Produit introuvable" : "Produit"} />
        {notFound ? (
          <div className={`${TILE} mt-6 flex flex-col items-center gap-4 px-6 py-12 text-center`}>
            <PackageX className="text-ink-3" size={30} aria-hidden />
            <p className="max-w-md text-ink-2">Ce produit ne figure plus au catalogue, ou le lien est erroné. Recherchez-le par nom, marque ou référence.</p>
            <Link href={BASE || "/"} className={btn("primary", "md")}>
              Retour au catalogue
            </Link>
          </div>
        ) : (
          <ErrorTile className="mt-6" message={errorMessage(res.error)} onRetry={() => void res.refetch()} />
        )}
      </div>
    );
  }
  return <ProductView key={res.data.product.id} product={res.data.product} />;
}
