import {
  ApiError,
  PRODUCT_PAGE_SIZE,
  type CategoryNode,
  type Product,
  type ProductListItem,
  type ShopBackend,
} from "@/core/contract";
import { currentUser } from "./auth";
import type { Deps } from "./state";

const toListItem = (p: Product): ProductListItem => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  brand: p.brand,
  imageUrl: p.images[0],
  priceCents: p.priceCents,
  unit: p.unit,
  inStock: p.stock > 0,
  negotiable: p.negotiable,
  minNegotiableQty: p.minNegotiableQty,
  rating: p.rating,
});

/** French collation, so « Échelle » sorts with E rather than after Z. */
const byName = new Intl.Collator("fr").compare;

/** Lower-cases and strips accents, so « metre », « Mètre » and « MÈTRE » all match. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function createCatalog(deps: Deps): ShopBackend["catalog"] {
  const { state } = deps;

  function categoryIdsFor(categoryId: string): Set<string> {
    const ids = new Set([categoryId]);
    for (const c of state.categories) if (c.parentId === categoryId) ids.add(c.id);
    return ids;
  }

  function countProducts(ids: Set<string>): number {
    let n = 0;
    for (const p of state.products.values()) if (ids.has(p.categoryId)) n++;
    return n;
  }

  return {
    async categories(ctx) {
      currentUser(deps, ctx);
      const bySort = [...state.categories].sort((a, b) => a.sortOrder - b.sortOrder || byName(a.name, b.name));
      const categories: CategoryNode[] = bySort
        .filter((c) => c.parentId === null)
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
          imageUrl: c.imageUrl,
          sortOrder: c.sortOrder,
          productCount: countProducts(categoryIdsFor(c.id)),
          children: bySort
            .filter((child) => child.parentId === c.id)
            .map((child) => ({
              id: child.id,
              slug: child.slug,
              name: child.name,
              imageUrl: child.imageUrl,
              productCount: countProducts(new Set([child.id])),
            })),
        }));
      return { categories };
    },

    async products(ctx, query) {
      currentUser(deps, ctx);
      let items = [...state.products.values()];
      if (query.category) {
        const category = state.categories.find((c) => c.slug === query.category);
        if (!category) throw new ApiError("NOT_FOUND", { message: "Catégorie introuvable." });
        const ids = categoryIdsFor(category.id);
        items = items.filter((p) => ids.has(p.categoryId));
      }
      if (query.q) {
        const q = fold(query.q);
        items = items.filter((p) => [p.name, p.brand, p.sku].some((field) => fold(field).includes(q)));
      }
      const sorters: Record<typeof query.sort, (a: Product, b: Product) => number> = {
        name: (a, b) => byName(a.name, b.name),
        price_asc: (a, b) => a.priceCents - b.priceCents || byName(a.name, b.name),
        price_desc: (a, b) => b.priceCents - a.priceCents || byName(a.name, b.name),
        newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      };
      items.sort(sorters[query.sort]);
      const start = (query.page - 1) * PRODUCT_PAGE_SIZE;
      return {
        items: items.slice(start, start + PRODUCT_PAGE_SIZE).map(toListItem),
        page: query.page,
        pageSize: PRODUCT_PAGE_SIZE,
        total: items.length,
      };
    },

    async product(ctx, slug) {
      currentUser(deps, ctx);
      const product = state.productsBySlug.get(slug);
      if (!product) throw new ApiError("NOT_FOUND", { message: "Produit introuvable." });
      return { product: structuredClone(product) };
    },
  };
}
