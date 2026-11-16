"use client";

import { ArrowRight, ArrowUpRight, ChevronDown, FileText, House, LayoutGrid, Lock, Mail, Package, Search, ShoppingBag, Trash2, User, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useCart, useCartMutations, useCategories, useMe, useNegotiation, useProducts } from "@/core/api/client/react";
import { OPEN_NEGOTIATION_STATUSES, type CategoryNode } from "@/core/contract";
import { BASE, BrandLogo, ProductImage, Sheet, Stepper, btn, errorMessage, formatCount, formatMoney, unitLabel, useToast } from "@/core/ui";

type Panel = null | "cart" | "departments" | "search";

/* ---------- Shared data for the chrome ---------- */

/** The open/accepted quote that currently locks the cart, if any. */
function useActiveQuote() {
  const cart = useCart();
  const id = cart.data?.lockedByNegotiationId ?? null;
  const quote = useNegotiation(id);
  return { id, quote: quote.data ?? null };
}

const isOpen = (status?: string) => !!status && (OPEN_NEGOTIATION_STATUSES as readonly string[]).includes(status);

/* ---------- Footer ---------- */

const footLink = "group inline-flex items-center gap-1.5 text-on-dark-2 transition-colors hover:text-on-dark focus-visible:text-on-dark";

function FootArrow() {
  return <ArrowRight size={13} className="-translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none" aria-hidden />;
}

function FootCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-on-dark">{title}</p>
      <span className="mt-2 block h-0.5 w-6 rounded-full bg-accent" aria-hidden />
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

function Footer() {
  const categories = useCategories().data?.categories ?? [];
  return (
    <footer className="mx-auto max-w-[1400px] px-3 pb-28 pt-6 lg:px-6 lg:pb-6 lg:pt-10">
      <div className="rounded-[28px] bg-dark px-6 py-5 text-sm text-on-dark-2 lg:px-10 lg:pb-6 lg:pt-10">
        <div className="hidden grid-cols-[1.25fr_1fr_1fr_1.15fr] gap-8 lg:grid">
          <div>
            <Link href={BASE || "/"} aria-label="SOCIMCO home" className="inline-block">
              <BrandLogo className="h-12" />
            </Link>
            <p className="mt-4 max-w-xs leading-relaxed">Private trade portal for approved SOCIMCO customers.</p>
          </div>
          <FootCol title="Departments">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`${BASE}/category/${c.slug}`} className={footLink}>
                  {c.name} <FootArrow />
                </Link>
              </li>
            ))}
          </FootCol>
          <FootCol title="Trade account">
            <li>
              <Link href={`${BASE}/negotiation`} className={footLink}>
                Quotes and trade pricing <FootArrow />
              </Link>
            </li>
            <li>
              <Link href={`${BASE}/orders`} className={footLink}>
                Orders <FootArrow />
              </Link>
            </li>
            <li>
              <Link href={`${BASE}/account`} className={footLink}>
                Account and addresses <FootArrow />
              </Link>
            </li>
          </FootCol>
          <FootCol title="Need an account?">
            <li className="leading-relaxed">Contact SOCIMCO to open a trade account.</li>
            <li>
              <a href="mailto:sales@socimco.example" className={`${footLink} gap-2`}>
                <Mail size={15} className="shrink-0 text-accent" aria-hidden /> sales@socimco.example
              </a>
            </li>
          </FootCol>
        </div>
        <div className="flex items-center justify-between gap-4 lg:mt-8 lg:border-t lg:border-white/10 lg:pt-5">
          <Link href={BASE || "/"} aria-label="SOCIMCO home" className="shrink-0 lg:hidden">
            <BrandLogo className="h-10" />
          </Link>
          <p className="text-[12px] max-lg:text-right">
            © {new Date().getFullYear()} SOCIMCO<span className="max-sm:hidden"> · Private trade portal</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ---------- Main navigation: icon pills with a sliding navy indicator ---------- */

type NavItem = { key: string; label: string; icon: LucideIcon; href?: string; active: boolean; badge?: number; pulse?: boolean };

function NavEntry({ item, onClick, expanded }: { item: NavItem; onClick?: () => void; expanded?: boolean }) {
  const Icon = item.icon;
  const cls = `group relative z-10 flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus xl:px-4 ${
    item.active ? "text-on-dark" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  }`;
  const body = (
    <>
      <Icon
        size={17}
        strokeWidth={item.active ? 2.25 : 2}
        className={`shrink-0 transition-[transform,color] duration-200 motion-reduce:transition-none ${item.active ? "text-accent" : "text-ink-3 group-hover:-translate-y-px group-hover:text-dark"}`}
        aria-hidden
      />
      <span className="hidden xl:inline">{item.label}</span>
      {expanded !== undefined && <ChevronDown size={15} className={`-ml-1 transition-transform xl:-ml-0.5 duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} aria-hidden />}
      {!!item.badge && (
        <span className={`tabular grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-ink ${item.pulse ? "hero-ping" : ""}`}>{item.badge}</span>
      )}
    </>
  );
  if (item.href) {
    return (
      <Link
        href={item.href}
        data-key={item.key}
        className={cls}
        aria-current={item.active ? "page" : undefined}
        aria-label={item.badge ? `${item.label}, ${item.pulse ? "your reply needed" : `${item.badge} open`}` : item.label}
        title={item.label}
      >
        {body}
      </Link>
    );
  }
  return (
    <button type="button" data-key={item.key} className={cls} aria-expanded={expanded} aria-label={item.label} title={item.label} onClick={onClick}>
      {body}
    </button>
  );
}

function MainNav({ mega, setMega, firstCategoryId }: { mega: string | null; setMega: (id: string | null) => void; firstCategoryId: string | null }) {
  const pathname = usePathname();
  const { quote } = useActiveQuote();
  const openQuote = isOpen(quote?.status) || quote?.status === "accepted";
  const home = BASE || "/";
  const items: NavItem[] = [
    { key: "home", label: "Home", icon: House, href: home, active: pathname === home },
    { key: "departments", label: "Departments", icon: LayoutGrid, active: mega !== null || pathname.startsWith(`${BASE}/category`) },
    { key: "quotes", label: "Quotes", icon: FileText, href: `${BASE}/negotiation`, active: pathname === `${BASE}/negotiation`, badge: openQuote ? 1 : 0, pulse: quote?.status === "awaiting_customer" },
    { key: "orders", label: "Orders", icon: Package, href: `${BASE}/orders`, active: pathname.startsWith(`${BASE}/orders`) },
  ];
  const activeKey = mega !== null ? "departments" : (items.find((i) => i.active)?.key ?? null);
  const shown = items.map((i) => ({ ...i, active: i.key === activeKey }));

  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const el = activeKey ? nav.querySelector<HTMLElement>(`[data-key="${activeKey}"]`) : null;
      setIndicator(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [activeKey, openQuote]);

  return (
    <nav ref={navRef} className="relative hidden items-center gap-1 lg:flex" aria-label="Main">
      <span
        aria-hidden
        className="btn-raised absolute top-0 h-11 rounded-full bg-dark transition-[left,width,opacity] duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none"
        style={{ left: indicator?.left ?? 0, width: indicator?.width ?? 0, opacity: indicator ? 1 : 0 }}
      />
      {shown.map((item) =>
        item.key === "departments" ? (
          <NavEntry key={item.key} item={item} expanded={mega !== null} onClick={() => setMega(mega ? null : firstCategoryId)} />
        ) : (
          <NavEntry key={item.key} item={item} />
        ),
      )}
    </nav>
  );
}

/* ---------- Header pieces ---------- */

function Logo() {
  return (
    <Link href={BASE || "/"} className="flex h-11 shrink-0 items-center" aria-label="SOCIMCO home">
      <BrandLogo className="h-10 lg:h-12" priority />
    </Link>
  );
}

function QuotePill() {
  const { quote } = useActiveQuote();
  if (!quote || !(isOpen(quote.status) || quote.status === "accepted")) return null;
  const label = quote.status === "awaiting_customer" ? "Your move" : quote.status === "accepted" ? "Price agreed" : "With the sales desk";
  const urgent = quote.status !== "awaiting_seller";
  return (
    <Link
      href={`${BASE}/negotiation`}
      className={`hidden h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold 2xl:inline-flex ${urgent ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink"}`}
    >
      <FileText size={15} aria-hidden />
      Quote · {label}
    </Link>
  );
}

function SearchForm({ autoFocus = false, onDone, large = false }: { autoFocus?: boolean; onDone?: () => void; large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`${BASE}/search?q=${encodeURIComponent(term)}`);
    onDone?.();
  };
  return (
    <form role="search" onSubmit={submit} className={`flex w-full items-center gap-2 rounded-full pl-4 pr-1 ${large ? "h-14 bg-surface ring-1 ring-black/5" : "h-11 bg-surface-2"}`}>
      <Search size={17} className="shrink-0 text-ink-3" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search products or SKU"
        aria-label="Search products"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
      />
      <button type="submit" className={`grid shrink-0 place-items-center rounded-full bg-dark text-on-dark hover:bg-dark-2 ${large ? "size-12" : "size-9"}`} aria-label="Search">
        <ArrowUpRight size={17} aria-hidden />
      </button>
    </form>
  );
}

/* ---------- Mega menu (desktop departments) ---------- */

function MegaFeatured({ category, onClose }: { category: CategoryNode; onClose: () => void }) {
  const products = useProducts({ category: category.slug });
  const featured = products.data?.items.slice(0, 2) ?? [];
  return (
    <ul className="mt-4 grid grid-cols-2 gap-3">
      {products.isPending &&
        [0, 1].map((i) => (
          <li key={i} className="shimmer h-20 rounded-[18px]" aria-hidden />
        ))}
      {featured.map((p) => (
        <li key={p.id}>
          <Link href={`${BASE}/products/${p.slug}`} onClick={onClose} className="flex gap-3 rounded-[18px] bg-surface-2 p-2 hover:bg-canvas">
            <ProductImage src={p.imageUrl} alt="" className="size-16 shrink-0 rounded-[14px] object-cover" />
            <span className="min-w-0 py-1">
              <span className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</span>
              <span className="tabular mt-0.5 block text-sm text-ink-2">{formatMoney(p.priceCents)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MegaMenu({ open, setOpen, categories }: { open: string | null; setOpen: (id: string | null) => void; categories: CategoryNode[] }) {
  const category = categories.find((c) => c.id === open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  if (!category) return null;
  const close = () => setOpen(null);
  return (
    <div className="absolute inset-x-0 top-full z-40 hidden pt-2 lg:block" onMouseLeave={close}>
      <div className="mx-auto grid max-w-[1400px] grid-cols-12 gap-6 rounded-[28px] bg-surface p-6 shadow-[0_30px_60px_-30px_rgb(6_22_61/0.45)] ring-1 ring-black/5">
        <ul className="col-span-3 space-y-1" aria-label="Departments">
          {categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseEnter={() => setOpen(c.id)}
                onFocus={() => setOpen(c.id)}
                onClick={() => setOpen(c.id)}
                aria-current={c.id === category.id}
                className={`flex h-11 w-full items-center justify-between rounded-full px-4 text-left text-[15px] font-medium ${c.id === category.id ? "bg-dark text-on-dark" : "hover:bg-surface-2"}`}
              >
                {c.name}
                <span className="tabular text-sm opacity-70">{c.productCount}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="col-span-5">
          <p className="display text-[22px]">{category.name}</p>
          <ul className="mt-3 grid grid-cols-2 gap-1">
            {category.children.length === 0 && <li className="text-sm text-ink-3">No subcategories</li>}
            {category.children.map((c) => (
              <li key={c.id}>
                <Link href={`${BASE}/category/${c.slug}`} onClick={close} className="flex h-11 items-center justify-between rounded-full px-3 text-[15px] hover:bg-surface-2">
                  {c.name}
                  <span className="tabular text-sm text-ink-3">{c.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
          <MegaFeatured category={category} onClose={close} />
        </div>
        <Link href={`${BASE}/category/${category.slug}`} onClick={close} className="group relative col-span-4 min-h-[260px] overflow-hidden rounded-[22px] bg-dark">
          <ProductImage src={category.imageUrl} alt="" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-white">
            <span>
              <span className="display block text-[20px]">Shop all {category.name}</span>
              <span className="text-[13px] text-white/80">{formatCount(category.productCount)} products</span>
            </span>
            <span className="grid size-10 place-items-center rounded-full bg-white/90 text-ink">
              <ArrowUpRight size={17} aria-hidden />
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

/* ---------- Drawers ---------- */

function SheetHead({ title, onClose, label }: { title: string; onClose: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <h2 className="display text-[22px]">{title}</h2>
      <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-surface-2 hover:bg-canvas" aria-label={label}>
        <X size={19} aria-hidden />
      </button>
    </div>
  );
}

function MiniCart({ onClose }: { onClose: () => void }) {
  const cart = useCart();
  const { update, remove } = useCartMutations();
  const { quote } = useActiveQuote();
  const { notify } = useToast();
  const data = cart.data;
  const lines = data?.items ?? [];
  const locked = !!data?.lockedByNegotiationId;
  const eligible = lines.filter((l) => l.negotiationEligible);
  const fail = (e: unknown) => notify(errorMessage(e), "danger");

  return (
    <div className="flex h-full flex-col bg-surface">
      <SheetHead title="Your cart" onClose={onClose} label="Close cart" />
      {locked && (
        <div className="mx-5 mb-2 flex gap-3 rounded-[18px] bg-accent-soft px-4 py-3 text-sm">
          <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Quantities are locked while your quote is {quote?.status === "accepted" ? "accepted" : "open"}.{" "}
            <Link href={`${BASE}/negotiation`} onClick={onClose} className="font-semibold underline underline-offset-4">
              View quote
            </Link>
          </p>
        </div>
      )}
      <ul className="flex-1 space-y-2 overflow-y-auto px-3" aria-busy={cart.isPending || undefined}>
        {cart.isPending && [0, 1].map((i) => <li key={i} className="shimmer h-28 rounded-[20px]" aria-hidden />)}
        {cart.isError && <li className="px-5 py-10 text-center text-danger">{errorMessage(cart.error)}</li>}
        {data && lines.length === 0 && <li className="px-5 py-10 text-center text-ink-3">Your cart is empty.</li>}
        {lines.map((l) => (
          <li key={l.productId} className="flex gap-3 rounded-[20px] bg-surface-2 p-3">
            <ProductImage src={l.imageUrl} alt="" className="size-[72px] shrink-0 rounded-[14px] object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <p className="line-clamp-2 flex-1 text-sm font-semibold">{l.name}</p>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => remove.mutate(l.productId, { onError: fail })}
                    className="-mr-1.5 -mt-2.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-danger"
                    aria-label={`Remove ${l.name}`}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
              <p className="tabular text-[13px] text-ink-3">
                {formatMoney(l.unitPriceCents)} / {unitLabel(l.unit, 1)}
              </p>
              {l.negotiationEligible && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-dark px-2.5 py-0.5 text-[11px] font-semibold text-on-dark">
                  <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Trade price eligible
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Stepper
                  value={l.quantity}
                  min={1}
                  max={99_999}
                  size="sm"
                  label={`Quantity of ${l.name}`}
                  disabled={locked || update.isPending}
                  className="w-[132px]"
                  onChange={(quantity) => update.mutate({ productId: l.productId, quantity }, { onError: fail })}
                />
                <p className="tabular font-semibold">{formatMoney(l.lineTotalCents)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data && (
        <div className="space-y-2.5 px-5 pb-5 pt-4">
          <div className="flex items-baseline justify-between pb-1">
            <span className="text-ink-2">Subtotal · {formatCount(data.itemCount)} items</span>
            <span className="tabular display text-[26px]">{formatMoney(data.subtotalCents)}</span>
          </div>
          {quote?.status === "accepted" ? (
            <Link href={`${BASE}/checkout`} onClick={onClose} className={btn("primary", "lg", "w-full")}>
              Checkout at agreed price
            </Link>
          ) : (
            <>
              {eligible.length > 0 && (
                <Link href={`${BASE}/negotiation`} onClick={onClose} className={btn("trade", "lg", "w-full")}>
                  {locked ? "View your quote" : `Request a trade price on ${eligible.length} line${eligible.length > 1 ? "s" : ""}`}
                </Link>
              )}
              {!locked && lines.length > 0 && (
                <Link href={`${BASE}/checkout`} onClick={onClose} className={btn("primary", "lg", "w-full")}>
                  Checkout{eligible.length ? " at list price" : ""}
                </Link>
              )}
            </>
          )}
          <Link href={`${BASE}/cart`} onClick={onClose} className={btn("ghost", "md", "w-full")}>
            View full cart
          </Link>
        </div>
      )}
    </div>
  );
}

function DepartmentsPanel({ onClose, categories }: { onClose: () => void; categories: CategoryNode[] }) {
  return (
    <div className="flex max-h-[88dvh] flex-col bg-surface">
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
      <SheetHead title="Departments" onClose={onClose} label="Close departments" />
      <ul className="grid grid-cols-2 gap-2.5 overflow-y-auto px-4 pb-8">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`${BASE}/category/${c.slug}`} onClick={onClose} className="relative block overflow-hidden rounded-[20px] bg-dark">
              <ProductImage src={c.imageUrl} alt="" className="aspect-[9/7] w-full object-cover" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <span className="absolute inset-x-3 bottom-2.5 text-white">
                <span className="display block text-[16px] leading-tight">{c.name}</span>
                <span className="tabular text-[12px] text-white/80">{c.productCount} products</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Shell ---------- */

export function Shell({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [mega, setMega] = useState<string | null>(null);
  const pathname = usePathname();
  const cart = useCart().data;
  const user = useMe().data?.user;
  const categories = useCategories().data?.categories ?? [];
  const { quote } = useActiveQuote();
  const close = () => setPanel(null);
  const awaitingYou = quote?.status === "awaiting_customer";
  const initials = (user?.name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const home = BASE || "/";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close menus and drawers on navigation
    setMega(null);
    setPanel(null);
  }, [pathname]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-full focus:bg-dark focus:px-4 focus:py-2 focus:text-on-dark">
        Skip to content
      </a>

      {/* Floating pill header (all sizes) */}
      <div className="sticky top-0 z-30 px-3 pt-3 lg:px-6">
        <header className="relative mx-auto max-w-[1400px]">
          <div className="flex h-14 items-center gap-2 rounded-full bg-surface/90 pl-5 pr-1.5 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.4)] ring-1 ring-black/5 backdrop-blur lg:h-16 lg:gap-5 lg:pr-2">
            <Logo />
            <MainNav mega={mega} setMega={setMega} firstCategoryId={categories[0]?.id ?? null} />
            <div className="ml-auto hidden min-w-0 max-w-[340px] flex-1 md:block">
              <SearchForm />
            </div>
            <QuotePill />
            <Link
              href={`${BASE}/account`}
              className={`hidden size-11 shrink-0 place-items-center rounded-full text-[13px] font-semibold lg:grid ${pathname === `${BASE}/account` ? "bg-dark text-on-dark" : "bg-surface-2 hover:bg-canvas"}`}
              aria-label={`Account${user ? `, ${user.name}` : ""}`}
              aria-current={pathname === `${BASE}/account` ? "page" : undefined}
            >
              {initials || <User size={18} aria-hidden />}
            </Link>
            <button
              type="button"
              onClick={() => setPanel("cart")}
              className="ml-auto flex h-11 shrink-0 items-center gap-2.5 rounded-full bg-dark pl-4 pr-1 text-[14px] font-semibold text-on-dark hover:bg-dark-2 md:ml-0 lg:h-12 lg:pr-1.5"
              aria-label={`Cart, ${cart?.items.length ?? 0} lines${cart ? `, ${formatMoney(cart.subtotalCents)}` : ""}`}
            >
              <ShoppingBag size={18} aria-hidden />
              <span className="tabular hidden sm:inline">{cart ? formatMoney(cart.subtotalCents) : "—"}</span>
              <span className="tabular grid size-9 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-ink">{cart?.items.length ?? 0}</span>
            </button>
          </div>
          <MegaMenu open={mega} setOpen={setMega} categories={categories} />
        </header>
      </div>

      {/* Mobile: always-visible search field */}
      <div className="px-3 pt-3 md:hidden">
        <button type="button" onClick={() => setPanel("search")} className="flex h-12 w-full items-center gap-2.5 rounded-full bg-surface px-4 text-left text-[15px] text-ink-3 ring-1 ring-black/5">
          <Search size={18} aria-hidden /> Search products or SKU
        </button>
      </div>

      <main id="main">{children}</main>

      <Footer />

      {/* Mobile floating nav */}
      <nav aria-label="Main" className="fixed inset-x-3 bottom-3 z-30 rounded-[22px] bg-dark px-1.5 text-on-dark shadow-2xl lg:hidden">
        <ul className="grid h-16 grid-cols-4">
          {[
            { label: "Home", icon: House, href: home },
            { label: "Shop", icon: LayoutGrid, onClick: () => setPanel("departments") },
            { label: "Quotes", icon: FileText, href: `${BASE}/negotiation`, dot: awaitingYou },
            { label: "Account", icon: User, href: `${BASE}/account` },
          ].map((item) => {
            const active = item.href !== undefined && (pathname === item.href || (item.label === "Account" && pathname.startsWith(`${BASE}/orders`)));
            const cls = `relative my-1.5 flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-[16px] text-[11px] font-medium ${active ? "bg-white/10 text-on-dark" : "text-on-dark-2"}`;
            const inner = (
              <>
                <item.icon size={20} aria-hidden />
                {item.label}
                {item.dot && <span className="absolute right-[calc(50%-16px)] top-1.5 size-2 rounded-full bg-accent" aria-label="Action needed" />}
              </>
            );
            return (
              <li key={item.label}>
                {item.href ? (
                  <Link href={item.href} className={cls} aria-current={active ? "page" : undefined}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={item.onClick} className={cls}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <Sheet open={panel === "cart"} onClose={close} side="right" label="Cart">
        <MiniCart onClose={close} />
      </Sheet>
      <Sheet open={panel === "departments"} onClose={close} side="bottom" label="Departments">
        <DepartmentsPanel onClose={close} categories={categories} />
      </Sheet>
      <Sheet open={panel === "search"} onClose={close} side="bottom" label="Search" className="max-h-[100dvh]! rounded-none!">
        <div className="flex h-[100dvh] flex-col bg-canvas">
          <div className="flex items-center gap-2 p-3">
            <SearchForm autoFocus onDone={close} large />
            <button type="button" onClick={close} className="grid size-12 shrink-0 place-items-center rounded-full bg-surface" aria-label="Close search">
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="px-4 pt-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Popular with trade buyers</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {["drill", "impact driver", "screws", "safety", "laser level"].map((s) => (
                <li key={s}>
                  <Link href={`${BASE}/search?q=${encodeURIComponent(s)}`} onClick={close} className="inline-flex h-11 items-center rounded-full bg-surface px-4 text-sm font-medium">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
