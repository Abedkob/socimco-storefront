import type {
  AddCartItemBody,
  CreateNegotiationBody,
  LoginBody,
  OrderListQuery,
  PlaceOrderBody,
  PriceLine,
  ProductQuery,
  QrApproveBody,
} from "@/core/contract";
import { contractAdapter } from "./adapter";
import { customAdapter } from "./adapters/custom-adapter";
import { adapterNameFromEnv, apiConfigFromEnv } from "./config";
import { createHttpClient, type HttpClient, type HttpClientOptions } from "./http";

type Opts = { signal?: AbortSignal };

/**
 * The storefront's whole view of the backend. Screens and hooks use only this object, so switching
 * from the mock to the client's API is a configuration change (see config.ts and adapter.ts).
 */
export function createStorefrontApi(http: HttpClient) {
  return {
    http,
    auth: {
      login: (body: LoginBody) => http.call("login", { body }),
      logout: () => http.call("logout"),
      me: (o: Opts = {}) => http.call("me", o),
    },
    qr: {
      create: () => http.call("qrCreate"),
      status: (id: string, o: Opts = {}) => http.call("qrStatus", { params: { id }, ...o }),
      scan: (code: string) => http.call("qrScan", { body: { code } }),
      approve: (body: QrApproveBody) => http.call("qrApprove", { body }),
      consume: (id: string) => http.call("qrConsume", { params: { id } }),
    },
    /** Phone sign-in: the signed-in computer shows a code (computer.*), a signed-out phone scans it (phone.*). */
    phoneSignIn: {
      computer: {
        create: (requireApproval: boolean) => http.call("phoneCodeCreate", { body: { requireApproval } }),
        status: (id: string, o: Opts = {}) => http.call("phoneCodeStatus", { params: { id }, ...o }),
        decide: (id: string, decision: "approve" | "deny") => http.call("phoneCodeDecide", { params: { id }, body: { decision } }),
      },
      phone: {
        redeem: (code: string) => http.call("phoneSignIn", { body: { code } }),
        status: (id: string, o: Opts = {}) => http.call("phoneSignInStatus", { params: { id }, ...o }),
        complete: (id: string) => http.call("phoneSignInComplete", { params: { id } }),
      },
    },
    catalog: {
      categories: (o: Opts = {}) => http.call("categories", o),
      products: (query: Partial<ProductQuery> = {}, o: Opts = {}) => http.call("products", { query, ...o }),
      product: (slug: string, o: Opts = {}) => http.call("product", { params: { slug }, ...o }),
    },
    cart: {
      get: (o: Opts = {}) => http.call("cart", o),
      add: (body: AddCartItemBody) => http.call("cartAdd", { body }),
      update: (productId: string, quantity: number) => http.call("cartUpdate", { params: { productId }, body: { quantity } }),
      remove: (productId: string) => http.call("cartRemove", { params: { productId } }),
    },
    negotiations: {
      create: (body: CreateNegotiationBody) => http.call("negotiationCreate", { body }),
      get: (id: string, o: Opts = {}) => http.call("negotiation", { params: { id }, ...o }),
      offer: (id: string, lines: PriceLine[], message?: string) =>
        http.call("negotiationRound", { params: { id }, body: { action: "offer", lines, message } }),
      accept: (id: string, message?: string) => http.call("negotiationRound", { params: { id }, body: { action: "accept", message } }),
      reject: (id: string, message?: string) => http.call("negotiationRound", { params: { id }, body: { action: "reject", message } }),
      cancel: (id: string) => http.call("negotiationCancel", { params: { id } }),
    },
    orders: {
      /** Pass the same key when retrying, so a timeout never creates a second order. */
      place: (body: PlaceOrderBody, idempotencyKey: string) => http.call("orderPlace", { body, idempotencyKey }),
      list: (query: Partial<OrderListQuery> = {}, o: Opts = {}) => http.call("orders", { query, ...o }),
      get: (id: string, o: Opts = {}) => http.call("order", { params: { id }, ...o }),
    },
  };
}

export type StorefrontApi = ReturnType<typeof createStorefrontApi>;

/**
 * The API the app uses at runtime, configured from NEXT_PUBLIC_API_* (mock by default):
 * base URL, cookie/bearer auth, timeout, and which adapter translates the backend's shapes.
 */
export function createDefaultStorefrontApi(overrides: Partial<HttpClientOptions> = {}): StorefrontApi {
  const adapter = adapterNameFromEnv() === "custom" ? customAdapter : contractAdapter;
  return createStorefrontApi(createHttpClient({ ...apiConfigFromEnv(), adapter, ...overrides }));
}
