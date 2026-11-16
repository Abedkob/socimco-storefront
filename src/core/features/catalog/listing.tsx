"use client";

import { ChevronLeft, ChevronRight, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useCategories, useProducts } from "@/core/api/client/react";
import type { CategoryNode, ProductListItem, ProductQuery } from "@/core/contract";
import { BASE, ErrorTile, PageHeader, ProductImage, Sheet, TILE, btn, errorMessage, formatCount } from "@/core/ui";
import { ProductGrid } from "./product-card";

type Sort = ProductQuery["sort"];

const SORTS: { value: Sort; label: string }[] = [
  { value: "name", label: "Name A–Z" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
];

type Filters = { inStockOnly: boolean; tradeOnly: boolean; brands: string[] };
const NO_FILTERS: Filters = { inStockOnly: false, tradeOnly: false, brands: [] };

/**
 * Brand, in-stock and trade-price filters run on the fetched page only.
 * TODO(contract): these need server support (the approved "attribute filters" extension adds
 * `brand`, `inStock` and `negotiable` to ProductQuery plus brand facets in ProductsResponse).
 * Until then, results and counts are for the current page of results.
 */
function applyFilters(items: ProductListItem[], f: Filters) {
  return items.filter((p) => (!f.inStockOnly || p.inStock) && (!f.tradeOnly || p.negotiable) && (f.brands.length === 0 || f.brands.includes(p.brand)));
}

const activeCount = (f: Filters) => Number(f.inStockOnly) + Number(f.tradeOnly) + f.brands.length;

/* ---------- Pieces ---------- */

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0 accent-[#06163d]" />
      {children}
    </label>
  );
}

const FILTER_HEADING = "text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3";

type Place = { current: { id: string; slug: string }; parent: CategoryNode };

function FilterPanel({ filters, setFilters, brands, place }: { filters: Filters; setFilters: (f: Filters) => void; brands: string[]; place?: Place }) {
  const row = (active: boolean, indent: boolean) => `flex min-h-11 items-center justify-between gap-3 rounded-full px-4 ${indent ? "pl-6" : ""} ${active ? "bg-dark font-semibold text-on-dark" : "hover:bg-surface-2"}`;
  return (
    <div className="space-y-6">
      {place && (
        <section>
          <h3 className={FILTER_HEADING}>Category</h3>
          <ul className="mt-3 space-y-0.5">
            <li>
              <Link href={`${BASE}/category/${place.parent.slug}`} aria-current={place.current.id === place.parent.id ? "page" : undefined} className={row(place.current.id === place.parent.id, false)}>
                All {place.parent.name} <span className="tabular opacity-70">{formatCount(place.parent.productCount)}</span>
              </Link>
            </li>
            {place.parent.children.map((c) => (
              <li key={c.id}>
                <Link href={`${BASE}/category/${c.slug}`} aria-current={place.current.id === c.id ? "page" : undefined} className={row(place.current.id === c.id, true)}>
                  {c.name} <span className="tabular opacity-70">{formatCount(c.productCount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h3 className={FILTER_HEADING}>Availability</h3>
        <div className="mt-2">
          <Check checked={filters.inStockOnly} onChange={(v) => setFilters({ ...filters, inStockOnly: v })}>
            In stock only
          </Check>
          <Check checked={filters.tradeOnly} onChange={(v) => setFilters({ ...filters, tradeOnly: v })}>
            Trade price available
          </Check>
        </div>
      </section>
      {brands.length > 0 && (
        <section>
          <h3 className={FILTER_HEADING}>Brand</h3>
          <div className="mt-2">
            {brands.map((b) => (
              <Check key={b} checked={filters.brands.includes(b)} onChange={(v) => setFilters({ ...filters, brands: v ? [...filters.brands, b] : filters.brands.filter((x) => x !== b) })}>
                {b}
              </Check>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SortSelect({ sort, onChange, id }: { sort: Sort; onChange: (s: Sort) => void; id: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="sr-only sm:not-sr-only sm:text-ink-3">
        Sort by
      </label>
      <select id={id} value={sort} onChange={(e) => onChange(e.target.value as Sort)} className="h-11 w-full min-w-0 rounded-full border border-line-strong bg-surface px-4 font-medium text-ink">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={btn("outline", "md")}>
        <ChevronLeft size={16} aria-hidden /> Previous
      </button>
      <span className="tabular text-sm text-ink-2" aria-live="polite">
        Page {page} of {pages}
      </span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={btn("outline", "md")}>
        Next <ChevronRight size={16} aria-hidden />
      </button>
    </nav>
  );
}

type Tile = { id: string; slug: string; name: string; imageUrl: string; productCount: number };

function CategoryTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className="-mx-3 mt-6 flex snap-x gap-3 overflow-x-auto px-3 pb-1 lg:mx-0 lg:px-0">
      {tiles.map((c) => (
        <li key={c.id} className="shrink-0 snap-start">
          <Link href={`${BASE}/category/${c.slug}`} className="flex w-[230px] items-center gap-3 rounded-[20px] bg-surface p-2 pr-4 ring-1 ring-transparent hover:ring-line-strong">
            <ProductImage src={c.imageUrl} alt="" className="size-14 shrink-0 rounded-[14px] object-cover" />
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">{c.name}</span>
              <span className="tabular text-sm text-ink-3">{formatCount(c.productCount)} products</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Shared listing ---------- */

function Listing({
  query,
  title,
  intro,
  crumbs,
  place,
  tiles,
  emptyTitle,
}: {
  query: { category?: string; q?: string };
  title: ReactNode;
  intro: (total: number | undefined) => ReactNode;
  crumbs: { label: string; href?: string }[];
  place?: Place;
  tiles?: Tile[];
  emptyTitle: string;
}) {
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const products = useProducts({ ...query, sort, page });
  const data = products.data;
  const brands = useMemo(() => [...new Set((data?.items ?? []).map((p) => p.brand))].sort((a, b) => a.localeCompare(b)), [data]);
  const items = applyFilters(data?.items ?? [], filters);
  const active = activeCount(filters);
  const count = active > 0 ? items.length : (data?.total ?? 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const stale = products.isPlaceholderData && products.isFetching;

  const changeSort = (s: Sort) => {
    setSort(s);
    setPage(1);
  };
  const changePage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const clear = () => setFilters(NO_FILTERS);

  let results: ReactNode;
  if (products.isPending) results = <ProductGrid items={[]} loading />;
  else if (products.isError)
    results = <ErrorTile message={`We couldn't load these products. ${errorMessage(products.error)}`} onRetry={() => void products.refetch()} />;
  else if (items.length === 0)
    results = (
      <div className={`${TILE} p-10 text-center`}>
        <SearchX className="mx-auto text-ink-3" size={30} aria-hidden />
        <p className="mt-3 text-lg font-semibold">{emptyTitle}</p>
        <p className="mt-1 text-ink-2">Try removing a filter or searching by SKU.</p>
        {active > 0 && (
          <button type="button" className={btn("outline", "md", "mt-5")} onClick={clear}>
            Clear filters
          </button>
        )}
      </div>
    );
  else
    results = (
      <div aria-busy={stale || undefined} className={`transition-opacity ${stale ? "opacity-60" : ""}`}>
        <ProductGrid items={items} />
        {data && data.total > data.pageSize && <Pagination page={page} pages={pages} onPage={changePage} />}
      </div>
    );

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-14 lg:px-6">
      <PageHeader crumbs={crumbs} title={title} lead={intro(data?.total)} />

      {tiles && tiles.length > 0 && <CategoryTiles tiles={tiles} />}

      {/* Mobile filter/sort bar */}
      <div className="sticky top-[76px] z-20 mt-5 flex items-center gap-1.5 rounded-full bg-surface/95 p-1.5 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.4)] ring-1 ring-black/5 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setFiltersOpen(true)} className={btn("ghost", "md", "flex-1 bg-surface-2")}>
          <SlidersHorizontal size={17} aria-hidden /> Filters
          {active > 0 && <span className="tabular grid size-5 place-items-center rounded-full bg-dark text-[11px] text-on-dark">{active}</span>}
        </button>
        <div className="min-w-0 flex-1">
          <SortSelect sort={sort} onChange={changeSort} id="sort-mobile" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[272px_1fr]">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-[96px] rounded-[var(--radius-card)] bg-surface p-5">
            <FilterPanel filters={filters} setFilters={setFilters} brands={brands} place={place} />
          </div>
        </aside>
        <section aria-label="Products" className="min-w-0">
          <div className="mb-4 hidden items-center justify-between gap-4 px-1 lg:flex">
            <p className="text-ink-2" aria-live="polite">
              <span className="tabular font-semibold text-ink">{formatCount(count)}</span> products
              {active > 0 && (
                <button type="button" onClick={clear} className="ml-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline underline-offset-4">
                  <X size={14} aria-hidden /> Clear {active} filter{active > 1 ? "s" : ""}
                </button>
              )}
            </p>
            <div className="w-[220px]">
              <SortSelect sort={sort} onChange={changeSort} id="sort-desktop" />
            </div>
          </div>
          {results}
        </section>
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} side="bottom" label="Filters">
        <div className="flex max-h-[88dvh] flex-col bg-surface">
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="display text-[22px]">Filters</h2>
            <button type="button" onClick={() => setFiltersOpen(false)} className="grid size-11 place-items-center rounded-full bg-surface-2" aria-label="Close filters">
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <FilterPanel filters={filters} setFilters={setFilters} brands={brands} place={place} />
          </div>
          <div className="flex gap-2 border-t border-line p-4">
            <button type="button" onClick={clear} className={btn("outline", "lg", "flex-1")} disabled={active === 0}>
              Clear
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)} className={btn("primary", "lg", "flex-[2]")}>
              Show {formatCount(count)} products
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/* ---------- Category ---------- */

function findCategory(categories: CategoryNode[], slug: string) {
  for (const node of categories) {
    if (node.slug === slug) return { current: node, parent: node, isTop: true };
    const child = node.children.find((c) => c.slug === slug);
    if (child) return { current: child, parent: node, isTop: false };
  }
  return undefined;
}

export function ListingSkeleton() {
  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-14 lg:px-6" aria-busy="true">
      <div className="px-1 pt-6">
        <div className="shimmer h-4 w-40 rounded-full" />
        <div className="shimmer mt-5 h-11 w-64 rounded-full" />
        <div className="shimmer mt-3 h-4 w-80 max-w-full rounded-full" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[272px_1fr]">
        <div className="shimmer hidden h-[420px] rounded-[var(--radius-card)] lg:block" />
        <ProductGrid items={[]} loading />
      </div>
    </div>
  );
}

function NotFound({ title, message, crumbs }: { title: string; message: string; crumbs: { label: string; href?: string }[] }) {
  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-14 lg:px-6">
      <PageHeader crumbs={crumbs} title={title} />
      <div className={`${TILE} mt-6 flex flex-col items-center gap-4 px-6 py-12 text-center`}>
        <SearchX className="text-ink-3" size={30} aria-hidden />
        <p className="max-w-md text-ink-2">{message}</p>
        <Link href={BASE || "/"} className={btn("primary", "md")}>
          Back to the catalog
        </Link>
      </div>
    </div>
  );
}

export function CategoryListing() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug ?? "");
  const categories = useCategories();

  if (categories.isPending) return <ListingSkeleton />;
  if (categories.isError)
    return (
      <div className="mx-auto max-w-[1400px] px-3 pb-14 lg:px-6">
        <PageHeader crumbs={[{ label: "Home", href: BASE || "/" }, { label: "Category" }]} title="Category" />
        <ErrorTile className="mt-6" message={errorMessage(categories.error)} onRetry={() => void categories.refetch()} />
      </div>
    );

  const all = categories.data.categories;
  const found = findCategory(all, slug);
  if (!found)
    return (
      <NotFound
        title="Category not found"
        message="This category doesn't exist or has moved. Browse the departments from the catalog."
        crumbs={[{ label: "Home", href: BASE || "/" }, { label: "Not found" }]}
      />
    );

  const { current, parent, isTop } = found;
  const children = isTop ? parent.children : [];
  const tiles: Tile[] | undefined = children.length ? children : isTop ? all.filter((c) => c.id !== current.id) : undefined;

  return (
    <Listing
      key={slug}
      query={{ category: slug }}
      title={current.name}
      intro={(total) => {
        const n = formatCount(total ?? current.productCount);
        return isTop
          ? `${n} products across ${children.length || 1} ranges. Trade pricing on volume orders.`
          : `${n} products in ${parent.name}. Prices shown per unit; trade pricing from the minimum quantity.`;
      }}
      crumbs={[{ label: "Home", href: BASE || "/" }, ...(isTop ? [] : [{ label: parent.name, href: `${BASE}/category/${parent.slug}` }]), { label: current.name }]}
      place={{ current, parent }}
      tiles={tiles}
      emptyTitle={`No ${current.name.toLowerCase()} match these filters`}
    />
  );
}

/* ---------- Search ---------- */

export function SearchListing() {
  const q = (useSearchParams().get("q") ?? "").trim().slice(0, 100);
  const crumbs = [{ label: "Home", href: BASE || "/" }, { label: "Search" }];

  if (!q)
    return (
      <div className="mx-auto max-w-[1400px] px-3 pb-14 lg:px-6">
        <PageHeader crumbs={crumbs} title="Search" lead="Search covers names, brands and SKUs." />
        <form action={`${BASE}/search`} role="search" className={`${TILE} mt-6 flex flex-col gap-3 p-5 sm:flex-row`}>
          <label htmlFor="search-page-q" className="sr-only">
            Search products
          </label>
          <input id="search-page-q" name="q" type="search" required placeholder="Product, brand or SKU" className="h-12 min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-5 text-[15px] text-ink placeholder:text-ink-3" />
          <button type="submit" className={btn("primary", "lg")}>
            <Search size={18} aria-hidden /> Search
          </button>
        </form>
      </div>
    );

  return (
    <Listing
      key={q}
      query={{ q }}
      title={`Results for “${q}”`}
      intro={(total) => (total ? `${formatCount(total)} ${total === 1 ? "product matches" : "products match"}. Search covers names, brands and SKUs.` : "Search covers names, brands and SKUs.")}
      crumbs={crumbs}
      emptyTitle={`No products match “${q}”`}
    />
  );
}
