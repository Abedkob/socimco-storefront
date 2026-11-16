"use client";

import { ArrowRight, ChevronRight, Loader2, Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatCount } from "./format";
import { useQuantityInput } from "./quantity";

/** Routes live at the site root. Kept as a constant so links read `${BASE}/cart` like the approved prototype. */
export const BASE = "";

/**
 * The client's logo (transparent cut-outs of the supplied artwork in /public/brand).
 * `full` is the navy badge with SOCIMCO; `mark` is the swirl-and-wrench icon for tight spaces.
 */
export function BrandLogo({ variant = "full", className = "h-10", priority = false }: { variant?: "full" | "mark"; className?: string; priority?: boolean }) {
  return variant === "mark" ? (
    <Image src="/brand/socimco-mark.png" alt="SOCIMCO" width={472} height={471} priority={priority} className={`w-auto ${className}`} />
  ) : (
    <Image src="/brand/socimco-logo.png" alt="SOCIMCO" width={1411} height={471} priority={priority} className={`w-auto ${className}`} />
  );
}

/**
 * Product and category imagery. Plain <img> on purpose: the URLs come from the API (the mock uses licensed
 * stock photos; the client's API will use its own image host), so no build-time host list is needed.
 */
export function ProductImage({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- image hosts come from the API at runtime
  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : undefined} className={className} />;
}

/** primary = SOCIMCO navy (every main action) · trade = SOCIMCO green (trade-price actions only) */
type Variant = "primary" | "trade" | "outline" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg";

export function btn(variant: Variant = "primary", size: Size = "md", extra = "") {
  const v: Record<Variant, string> = {
    primary: "btn-raised bg-dark text-on-dark hover:bg-dark-2 disabled:bg-surface-2 disabled:bg-none disabled:text-ink-3 disabled:shadow-none",
    trade: "btn-raised bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-surface-2 disabled:bg-none disabled:text-ink-3 disabled:shadow-none",
    outline: "btn-quiet border border-line-strong bg-surface text-ink hover:border-ink hover:bg-surface-2 disabled:text-ink-3 disabled:border-line",
    ghost: "text-ink hover:bg-surface-2 disabled:text-ink-3",
    danger: "btn-quiet border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
    light: "btn-quiet bg-surface text-ink hover:bg-surface-2",
  };
  const s: Record<Size, string> = {
    sm: "h-11 px-4 text-sm sm:h-10",
    md: "h-11 px-5 text-[15px]",
    lg: "h-12 px-6 text-[15px]",
  };
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.005em] transition-[background-color,border-color,box-shadow,transform] duration-200 ${v[variant]} ${s[size]} ${extra}`;
}

/** Round icon button (the Bento signature navy circle). */
export function iconBtn(extra = "") {
  return `btn-raised grid size-11 shrink-0 place-items-center rounded-full bg-dark text-on-dark transition-[background-color,box-shadow,transform] duration-200 hover:bg-dark-2 disabled:bg-surface-2 disabled:bg-none disabled:text-ink-3 disabled:shadow-none ${extra}`;
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  size = "md",
  label,
  disabled = false,
  className = "",
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  size?: "sm" | "md";
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const q = useQuantityInput(value, min, max, onChange);
  const h = size === "sm" ? "h-11 sm:h-10" : "h-12";
  const w = size === "sm" ? "w-11 shrink-0 sm:w-10" : "w-12 shrink-0";
  return (
    <div className={`inline-flex ${h} items-stretch overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-line-strong ${disabled ? "opacity-60" : ""} ${className}`}>
      <button type="button" aria-label={`Diminuer : ${label}`} onClick={q.decrement} disabled={disabled || !q.canDecrement} className={`${w} grid place-items-center text-ink hover:bg-surface-2 disabled:text-line-strong`}>
        <Minus size={16} aria-hidden />
      </button>
      <input {...q.inputProps} aria-label={label} disabled={disabled} className="tabular w-12 min-w-0 flex-1 bg-transparent text-center font-semibold text-ink outline-none focus-visible:bg-accent-soft" />
      <button type="button" aria-label={`Augmenter : ${label}`} onClick={q.increment} disabled={disabled || !q.canIncrement} className={`${w} grid place-items-center text-ink hover:bg-surface-2 disabled:text-line-strong`}>
        <Plus size={16} aria-hidden />
      </button>
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3 ${className}`}>{children}</p>;
}

/** Navy pill with a green dot: marks products that unlock trade pricing from a quantity. */
export function TradeBadge({ qty, className = "" }: { qty: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-dark px-2.5 py-1 text-[11px] font-semibold text-on-dark ${className}`}>
      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
      Négociable dès {formatCount(qty)}
    </span>
  );
}

/** Stock as a coloured dot + text. Pass `stock` when the API gives a count, or just `inStock` from list views. */
export function StockLine({ stock, inStock, compact = false }: { stock?: number; inStock?: boolean; compact?: boolean }) {
  const size = compact ? "text-[12px]" : "text-sm";
  const available = stock !== undefined ? stock > 0 : inStock !== false;
  if (!available) return <span className={`${size} font-medium text-danger`}>Rupture de stock</span>;
  const low = stock !== undefined && stock < 100;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${size} font-medium ${low ? "text-warning" : "text-success"}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${low ? "bg-warning" : "bg-success"}`} aria-hidden />
      {stock === undefined ? "En stock" : low ? `Stock faible · plus que ${formatCount(stock)}` : `${formatCount(stock)} en stock`}
    </span>
  );
}

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex items-end justify-between gap-4 px-1">
      <div>
        <h2 className="display text-[26px] leading-none lg:text-[34px]">{title}</h2>
        {sub && <p className="mt-2 text-[15px] text-ink-3">{sub}</p>}
      </div>
      {action && <ActionLink href={action.href}>{action.label}</ActionLink>}
    </div>
  );
}

/** Breadcrumb + h1 + optional lead and actions. */
export function PageHeader({ crumbs, title, lead, aside }: { crumbs: { label: string; href?: string }[]; title: ReactNode; lead?: ReactNode; aside?: ReactNode }) {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="px-1 pt-4 text-sm text-ink-3">
        <ol className="flex flex-wrap items-center gap-x-1">
          {crumbs.map((c, i) => (
            <li key={c.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} aria-hidden />}
              {c.href ? (
                <Link href={c.href} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="inline-flex min-h-11 items-center text-ink">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1">
        <div className="min-w-0">
          <h1 className="display text-[34px] leading-[1.05] sm:text-[46px]">{title}</h1>
          {lead && <p className="mt-2 max-w-2xl text-[15px] text-ink-3">{lead}</p>}
        </div>
        {aside}
      </header>
    </>
  );
}

/** French labels for the order statuses the API sends. */
export const ORDER_STATUS_LABEL: Record<string, string> = { confirmed: "Confirmée", processing: "En préparation", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };

const ORDER_STATUS: Record<string, string> = {
  confirmed: "bg-surface-2 text-ink-2",
  processing: "bg-warning-soft text-warning",
  shipped: "bg-dark text-on-dark",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-danger-soft text-danger",
};

export function OrderStatusChip({ status }: { status: string }) {
  return <span className={`inline-flex h-7 items-center rounded-full px-3 text-[12px] font-semibold ${ORDER_STATUS[status] ?? "bg-surface-2 text-ink-2"}`}>{ORDER_STATUS_LABEL[status] ?? status}</span>;
}

export function NegotiatedChip({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-[11px] font-semibold text-success ${className}`}>
      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
      Négocié
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 size={18} className={`animate-spin motion-reduce:animate-none ${className}`} aria-hidden />;
}

/** White rounded tile, the Bento building block. */
export const TILE = "rounded-[var(--radius-card)] bg-surface";

/** "See all"-style navigation as a pill button: label plus a navy arrow disc that slides on hover. */
export function ActionLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`btn-quiet group inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full bg-surface py-1.5 pl-4 pr-1.5 text-[14px] font-semibold text-ink ring-1 ring-inset ring-line transition-[box-shadow,background-color] duration-200 hover:bg-surface-2 hover:ring-line-strong ${className}`}
    >
      {children}
      <span className="btn-raised grid size-8 place-items-center rounded-full bg-dark text-on-dark transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>
        <ArrowRight size={15} />
      </span>
    </Link>
  );
}

/** Tile shown when a query fails: says what happened and offers a retry. */
export function ErrorTile({ message, onRetry, className = "" }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={`${TILE} flex flex-col items-center gap-4 px-6 py-12 text-center ${className}`}>
      <p className="max-w-md text-ink-2">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={btn("outline", "md")}>
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Friendly text for an error thrown by the API client (ApiError) or anything else. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Une erreur est survenue. Veuillez réessayer.";
}
