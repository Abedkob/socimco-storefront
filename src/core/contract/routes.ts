import type { z, ZodType } from "zod";
import {
  AddCartItemBody,
  Cart,
  CategoriesResponse,
  CreateNegotiationBody,
  CustomerRoundBody,
  LoginBody,
  Negotiation,
  OkResponse,
  OrderListQuery,
  OrderResponse,
  OrdersResponse,
  PhoneCodeCreateBody,
  PhoneCodeDecisionBody,
  PhoneCodeResponse,
  PhoneCodeStatusResponse,
  PhoneSignInResponse,
  PlaceOrderBody,
  ProductQuery,
  ProductResponse,
  ProductsResponse,
  QrApproveBody,
  QrApproveResponse,
  QrCodeBody,
  QrCreateResponse,
  QrScanResponse,
  QrStatusResponse,
  SellerListQuery,
  SellerNegotiationsResponse,
  SellerRoundBody,
  UpdateCartItemBody,
  UserResponse,
} from "./schemas";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface RouteDef {
  method: HttpMethod;
  path: string;
  body?: ZodType;
  query?: ZodType;
  response: ZodType;
}

export const apiRoutes = {
  login: { method: "POST", path: "/api/auth/login", body: LoginBody, response: UserResponse },
  logout: { method: "POST", path: "/api/auth/logout", response: OkResponse },
  me: { method: "GET", path: "/api/auth/me", response: UserResponse },

  qrCreate: { method: "POST", path: "/api/auth/qr", response: QrCreateResponse },
  qrStatus: { method: "GET", path: "/api/auth/qr/:id", response: QrStatusResponse },
  qrScan: { method: "POST", path: "/api/auth/qr/scan", body: QrCodeBody, response: QrScanResponse },
  qrApprove: { method: "POST", path: "/api/auth/qr/approve", body: QrApproveBody, response: QrApproveResponse },
  qrConsume: { method: "POST", path: "/api/auth/qr/:id/consume", response: UserResponse },

  // Phone sign-in (the reverse of QR login): a signed-in computer shows a code, a signed-out phone scans it.
  phoneCodeCreate: { method: "POST", path: "/api/auth/qr/phone", body: PhoneCodeCreateBody, response: PhoneCodeResponse },
  phoneCodeStatus: { method: "GET", path: "/api/auth/qr/phone/:id", response: PhoneCodeStatusResponse },
  phoneCodeDecide: { method: "POST", path: "/api/auth/qr/phone/:id/decision", body: PhoneCodeDecisionBody, response: QrApproveResponse },
  phoneSignIn: { method: "POST", path: "/api/auth/qr/phone/redeem", body: QrCodeBody, response: PhoneSignInResponse },
  phoneSignInStatus: { method: "GET", path: "/api/auth/qr/phone/:id/progress", response: QrStatusResponse },
  phoneSignInComplete: { method: "POST", path: "/api/auth/qr/phone/:id/complete", response: UserResponse },

  categories: { method: "GET", path: "/api/categories", response: CategoriesResponse },
  products: { method: "GET", path: "/api/products", query: ProductQuery, response: ProductsResponse },
  product: { method: "GET", path: "/api/products/:slug", response: ProductResponse },

  cart: { method: "GET", path: "/api/cart", response: Cart },
  cartAdd: { method: "POST", path: "/api/cart/items", body: AddCartItemBody, response: Cart },
  cartUpdate: { method: "PATCH", path: "/api/cart/items/:productId", body: UpdateCartItemBody, response: Cart },
  cartRemove: { method: "DELETE", path: "/api/cart/items/:productId", response: Cart },

  negotiationCreate: { method: "POST", path: "/api/negotiations", body: CreateNegotiationBody, response: Negotiation },
  negotiation: { method: "GET", path: "/api/negotiations/:id", response: Negotiation },
  negotiationRound: {
    method: "POST",
    path: "/api/negotiations/:id/rounds",
    body: CustomerRoundBody,
    response: Negotiation,
  },
  negotiationCancel: { method: "POST", path: "/api/negotiations/:id/cancel", response: Negotiation },

  sellerNegotiations: {
    method: "GET",
    path: "/api/seller/negotiations",
    query: SellerListQuery,
    response: SellerNegotiationsResponse,
  },
  sellerNegotiation: { method: "GET", path: "/api/seller/negotiations/:id", response: Negotiation },
  sellerRound: {
    method: "POST",
    path: "/api/seller/negotiations/:id/rounds",
    body: SellerRoundBody,
    response: Negotiation,
  },

  orderPlace: { method: "POST", path: "/api/orders", body: PlaceOrderBody, response: OrderResponse },
  orders: { method: "GET", path: "/api/orders", query: OrderListQuery, response: OrdersResponse },
  order: { method: "GET", path: "/api/orders/:id", response: OrderResponse },
} as const satisfies Record<string, RouteDef>;

export type ApiRoutes = typeof apiRoutes;
export type RouteName = keyof ApiRoutes;

type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<Rest>
  : P extends `${string}:${infer Name}`
    ? Name
    : never;

export type RouteParams<R extends RouteName> = Record<ParamNames<ApiRoutes[R]["path"]>, string>;
export type RouteBody<R extends RouteName> = ApiRoutes[R] extends { body: infer S extends ZodType } ? z.input<S> : undefined;
export type RouteQuery<R extends RouteName> = ApiRoutes[R] extends { query: infer S extends ZodType }
  ? z.input<S>
  : undefined;
export type RouteResponse<R extends RouteName> = z.output<ApiRoutes[R]["response"]>;

export const IDEMPOTENCY_HEADER = "idempotency-key";
export const SESSION_COOKIE = "session";
export const QR_POLL_COOKIE = "qr_poll";
export const QR_POLL_COOKIE_PATH = "/api/auth/qr";

export function buildPath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path param "${name}" for ${path}`);
    return encodeURIComponent(value);
  });
}
