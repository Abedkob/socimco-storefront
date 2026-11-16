"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCartMutations } from "@/core/api/client/react";
import type { ProductListItem } from "@/core/contract";
import { BASE, ProductImage, StockLine, Stepper, TradeBadge, btn, errorMessage, formatCount, formatMoney, unitLabel, useToast } from "@/core/ui";

/**
 * Catalog card for a list item. List items carry only `inStock` (no stock count or minimum order),
 * so the quantity starts at 1 and the server validates it; its message is shown as a toast.
 */
export function ProductCard({ product, priority = false }: { product: ProductListItem; priority?: boolean }) {
  const { add } = useCartMutations();
  const { notify } = useToast();
  const [qty, setQty] = useState(1);
  const soldOut = !product.inStock;

  const addToCart = () =>
    add.mutate(
      { productId: product.id, quantity: qty },
      {
        onSuccess: () => notify(`Ajouté au panier : ${formatCount(qty)} × ${product.name}`),
        onError: (e) => notify(errorMessage(e), "danger"),
      },
    );

  return (
    <article className="group relative flex h-full flex-col rounded-[var(--radius-card)] bg-surface p-2.5 transition-shadow hover:shadow-[0_18px_40px_-24px_rgb(6_22_61/0.45)]">
      <Link href={`${BASE}/products/${product.slug}`} className="relative block overflow-hidden rounded-[18px] bg-canvas" tabIndex={-1} aria-hidden>
        <ProductImage src={product.imageUrl} alt="" priority={priority} className="aspect-[8/7] w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        {product.negotiable && product.minNegotiableQty && <TradeBadge qty={product.minNegotiableQty} className="absolute left-2.5 top-2.5" />}
      </Link>
      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3.5">
        <p className="truncate text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{product.brand}</p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.6em] text-[15px] font-semibold leading-snug text-ink">
          <Link
            href={`${BASE}/products/${product.slug}`}
            className="after:absolute after:inset-0 after:rounded-[var(--radius-card)] after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-focus"
          >
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto pt-3">
          <p className="tabular display text-[22px] leading-none text-ink">
            {formatMoney(product.priceCents)}
            <span className="ml-1 font-sans text-[12px] font-normal tracking-normal text-ink-3">/ {unitLabel(product.unit, 1)}</span>
          </p>
          <p className="mt-1.5">
            <StockLine inStock={product.inStock} compact />
          </p>
          <div className="@container relative z-10 mt-3">
            <div className="flex flex-col gap-1.5 @min-[176px]:flex-row">
              <Stepper value={qty} min={1} max={99_999} onChange={setQty} size="sm" label={`Quantité : ${product.name}`} disabled={soldOut} className="w-full @min-[176px]:w-[118px]" />
              <button type="button" onClick={addToCart} disabled={soldOut || add.isPending} aria-busy={add.isPending || undefined} className={btn("primary", "sm", "w-full px-3 @min-[176px]:flex-1")}>
                {/* "Ajouter" doesn't fit next to the stepper on narrow cards: icon only there, text kept for screen readers. */}
                <Plus size={16} aria-hidden /> <span className="@min-[176px]:@max-[223px]:sr-only">Ajouter</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-2.5" aria-hidden>
      <div className="shimmer aspect-[8/7] rounded-[18px]" />
      <div className="space-y-2 px-2 pb-2 pt-4">
        <div className="shimmer h-3 w-1/3 rounded-full" />
        <div className="shimmer h-4 w-5/6 rounded-full" />
        <div className="shimmer h-4 w-2/3 rounded-full" />
        <div className="shimmer mt-4 h-6 w-1/3 rounded-full" />
        <div className="shimmer h-10 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Responsive product grid with skeletons while loading. */
export function ProductGrid({ items, loading, skeletons = 8, className = "grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 xl:gap-4" }: { items: ProductListItem[]; loading?: boolean; skeletons?: number; className?: string }) {
  if (loading) {
    return (
      <ul className={`grid ${className}`} aria-busy="true" aria-label="Chargement des produits">
        {Array.from({ length: skeletons }, (_, i) => (
          <li key={i}>
            <ProductCardSkeleton />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={`grid ${className}`}>
      {items.map((p, i) => (
        <li key={p.id}>
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}
