"use client";

import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import {
  isApiError,
  OPEN_NEGOTIATION_STATUSES,
  type AddCartItemBody,
  type Cart,
  type CreateNegotiationBody,
  type LoginBody,
  type Negotiation,
  type PlaceOrderBody,
  type PriceLine,
  type ProductQuery,
  type QrStatus,
} from "@/core/contract";
import { createDefaultStorefrontApi, type StorefrontApi } from "./storefront-api";

/* ---------- Provider ---------- */

const ApiContext = createContext<StorefrontApi | null>(null);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Don't hammer the API on errors the user must fix (bad input, signed out, not found).
        retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}

/** Wrap the app once (in a client layout). `api` is injectable for tests and previews. */
export function ApiProvider({ children, api }: { children: ReactNode; api?: StorefrontApi }) {
  const [client] = useState(makeQueryClient);
  const [value] = useState(() => api ?? createDefaultStorefrontApi());
  return (
    <ApiContext.Provider value={value}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ApiContext.Provider>
  );
}

export function useApi(): StorefrontApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi must be used inside <ApiProvider>");
  return api;
}

/* ---------- Query keys (one place, so invalidation stays consistent) ---------- */

export const queryKeys = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  products: (q: Partial<ProductQuery>) => ["products", q] as const,
  product: (slug: string) => ["product", slug] as const,
  cart: ["cart"] as const,
  negotiation: (id: string) => ["negotiation", id] as const,
  orders: (limit?: number) => ["orders", limit ?? null] as const,
  order: (id: string) => ["order", id] as const,
  qr: (id: string) => ["qr", id] as const,
};

/* ---------- Session ---------- */

export function useMe() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.me, queryFn: ({ signal }) => api.auth.me({ signal }), retry: false });
}

export function useLogin() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginBody) => api.auth.login(body),
    onSuccess: (data) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, data);
    },
  });
}

export function useLogout() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.auth.logout(), onSettled: () => qc.clear() });
}

/* ---------- Catalog ---------- */

export function useCategories() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.categories, queryFn: ({ signal }) => api.catalog.categories({ signal }), staleTime: 5 * 60_000 });
}

export function useProducts(query: Partial<ProductQuery>) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.products(query), queryFn: ({ signal }) => api.catalog.products(query, { signal }), placeholderData: (prev) => prev });
}

export function useProduct(slug: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.product(slug), queryFn: ({ signal }) => api.catalog.product(slug, { signal }) });
}

/* ---------- Cart: every mutation returns the full cart, which goes straight into the cache ---------- */

export function useCart() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.cart, queryFn: ({ signal }) => api.cart.get({ signal }), staleTime: 0 });
}

export function useCartMutations() {
  const api = useApi();
  const qc = useQueryClient();
  const write = (cart: Cart) => qc.setQueryData(queryKeys.cart, cart);
  return {
    add: useMutation({ mutationFn: (body: AddCartItemBody) => api.cart.add(body), onSuccess: write }),
    update: useMutation({ mutationFn: (v: { productId: string; quantity: number }) => api.cart.update(v.productId, v.quantity), onSuccess: write }),
    remove: useMutation({ mutationFn: (productId: string) => api.cart.remove(productId), onSuccess: write }),
  };
}

/* ---------- Negotiation: poll every 5 s while it's the sales desk's turn; pauses when the tab is hidden ---------- */

const isOpen = (n?: Negotiation) => !!n && OPEN_NEGOTIATION_STATUSES.includes(n.status);

export function useNegotiation(id: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.negotiation(id ?? "none"),
    queryFn: ({ signal }) => api.negotiations.get(id!, { signal }),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.status === "awaiting_seller" ? 5_000 : false),
    refetchIntervalInBackground: false,
  });
}

export function useNegotiationActions() {
  const api = useApi();
  const qc = useQueryClient();
  const write = (n: Negotiation) => {
    qc.setQueryData(queryKeys.negotiation(n.id), n);
    // Opening or closing a quote locks/unlocks the cart.
    if (!isOpen(n) || n.rounds.length <= 1) void qc.invalidateQueries({ queryKey: queryKeys.cart });
  };
  return {
    create: useMutation({ mutationFn: (body: CreateNegotiationBody) => api.negotiations.create(body), onSuccess: write }),
    offer: useMutation({ mutationFn: (v: { id: string; lines: PriceLine[]; message?: string }) => api.negotiations.offer(v.id, v.lines, v.message), onSuccess: write }),
    accept: useMutation({ mutationFn: (id: string) => api.negotiations.accept(id), onSuccess: write }),
    reject: useMutation({ mutationFn: (id: string) => api.negotiations.reject(id), onSuccess: write }),
    cancel: useMutation({ mutationFn: (id: string) => api.negotiations.cancel(id), onSuccess: write }),
  };
}

/* ---------- Orders ---------- */

export function useOrders(limit?: number) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.orders(limit), queryFn: ({ signal }) => api.orders.list(limit ? { limit } : {}, { signal }) });
}

export function useOrder(id: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.order(id), queryFn: ({ signal }) => api.orders.get(id, { signal }) });
}

/**
 * Places an order with an idempotency key that is reused if the same order is retried
 * (e.g. after a timeout), and replaced only after a success. One click = one order.
 */
export function usePlaceOrder() {
  const api = useApi();
  const qc = useQueryClient();
  const key = useRef<string | null>(null);
  return useMutation({
    mutationFn: (body: PlaceOrderBody) => {
      key.current ??= crypto.randomUUID();
      return api.orders.place(body, key.current);
    },
    onSuccess: (data) => {
      key.current = null;
      qc.setQueryData(queryKeys.order(data.order.id), data);
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
      void qc.invalidateQueries({ queryKey: ["negotiation"] });
    },
  });
}

/* ---------- QR sign-in: poll every 2 s until the code reaches a final state ---------- */

const QR_FINAL: QrStatus[] = ["approved", "denied", "expired", "consumed"];

export function useQrLogin() {
  const api = useApi();
  const qc = useQueryClient();
  const create = useMutation({ mutationFn: () => api.qr.create() });
  const id = create.data?.id ?? null;
  const status = useQuery({
    queryKey: queryKeys.qr(id ?? "none"),
    queryFn: ({ signal }) => api.qr.status(id!, { signal }),
    enabled: !!id,
    staleTime: 0,
    refetchInterval: (q) => (q.state.data && QR_FINAL.includes(q.state.data.status) ? false : 2_000),
    refetchIntervalInBackground: false,
  });
  const consume = useMutation({
    mutationFn: () => api.qr.consume(id!),
    onSuccess: (data) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, data);
    },
  });
  return { create, status, consume, code: create.data ?? null };
}
