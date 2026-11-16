import type { z, ZodType } from "zod";
import {
  ApiError,
  apiRoutes,
  type ApiRoutes,
  type RequestContext,
  type RouteDef,
  type RouteName,
  type RouteParams,
  type SessionGrant,
  type ShopBackend,
} from "@/core/contract";

export interface RawInput {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  idempotencyKey: string | null;
}

export interface CookieEffects {
  /** A grant sets the session cookie; null clears it. */
  session?: SessionGrant | null;
  qrPoll?: { token: string; expiresAt: string } | null;
}

export interface RouteResult {
  status: number;
  body: unknown;
  cookies: CookieEffects;
}

type Parsed<R extends RouteName, K extends "body" | "query"> = ApiRoutes[R] extends { [P in K]: infer S extends ZodType }
  ? z.output<S>
  : undefined;

interface HandlerInput<R extends RouteName> {
  params: RouteParams<R>;
  query: Parsed<R, "query">;
  body: Parsed<R, "body">;
  idempotencyKey: string | null;
}

type Handler<R extends RouteName> = (
  backend: ShopBackend,
  ctx: RequestContext,
  input: HandlerInput<R>,
) => Promise<{ body: unknown; status?: number; cookies?: CookieEffects }>;

const handlers: { [R in RouteName]: Handler<R> } = {
  login: async (b, ctx, { body }) => {
    const { user, session } = await b.auth.login(ctx, body);
    return { body: { user }, cookies: { session } };
  },
  logout: async (b, ctx) => {
    await b.auth.logout(ctx);
    return { body: { ok: true }, cookies: { session: null } };
  },
  me: async (b, ctx) => ({ body: await b.auth.me(ctx) }),

  qrCreate: async (b, ctx) => {
    const { pollToken, ...body } = await b.qr.create(ctx);
    return { status: 201, body, cookies: { qrPoll: { token: pollToken, expiresAt: body.expiresAt } } };
  },
  qrStatus: async (b, ctx, { params }) => ({ body: await b.qr.status(ctx, params.id) }),
  qrScan: async (b, ctx, { body }) => ({ body: await b.qr.scan(ctx, body) }),
  qrApprove: async (b, ctx, { body }) => ({ body: await b.qr.approve(ctx, body) }),
  qrConsume: async (b, ctx, { params }) => {
    const { user, session } = await b.qr.consume(ctx, params.id);
    return { body: { user }, cookies: { session, qrPoll: null } };
  },

  categories: async (b, ctx) => ({ body: await b.catalog.categories(ctx) }),
  products: async (b, ctx, { query }) => ({ body: await b.catalog.products(ctx, query) }),
  product: async (b, ctx, { params }) => ({ body: await b.catalog.product(ctx, params.slug) }),

  cart: async (b, ctx) => ({ body: await b.cart.get(ctx) }),
  cartAdd: async (b, ctx, { body }) => ({ body: await b.cart.addItem(ctx, body) }),
  cartUpdate: async (b, ctx, { params, body }) => ({ body: await b.cart.updateItem(ctx, params.productId, body) }),
  cartRemove: async (b, ctx, { params }) => ({ body: await b.cart.removeItem(ctx, params.productId) }),

  negotiationCreate: async (b, ctx, { body }) => ({ status: 201, body: await b.negotiations.create(ctx, body) }),
  negotiation: async (b, ctx, { params }) => ({ body: await b.negotiations.get(ctx, params.id) }),
  negotiationRound: async (b, ctx, { params, body }) => ({ body: await b.negotiations.round(ctx, params.id, body) }),
  negotiationCancel: async (b, ctx, { params }) => ({ body: await b.negotiations.cancel(ctx, params.id) }),

  sellerNegotiations: async (b, ctx, { query }) => ({ body: await b.seller.list(ctx, query) }),
  sellerNegotiation: async (b, ctx, { params }) => ({ body: await b.seller.get(ctx, params.id) }),
  sellerRound: async (b, ctx, { params, body }) => ({ body: await b.seller.round(ctx, params.id, body) }),

  orderPlace: async (b, ctx, { body, idempotencyKey }) => {
    const { order, created } = await b.orders.place(ctx, { ...body, idempotencyKey });
    return { status: created ? 201 : 200, body: { order } };
  },
  orders: async (b, ctx, { query }) => ({ body: await b.orders.list(ctx, query) }),
  order: async (b, ctx, { params }) => ({ body: await b.orders.get(ctx, params.id) }),
};

function parse(schema: ZodType, value: unknown): unknown {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError("VALIDATION_FAILED", {
      details: { issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    });
  }
  return result.data;
}

/** Validates raw input against the route's schemas and calls the backend. Transport-agnostic. */
export async function executeRoute(
  backend: ShopBackend,
  name: RouteName,
  ctx: RequestContext,
  raw: RawInput,
): Promise<RouteResult> {
  const def: RouteDef = apiRoutes[name];
  const input = {
    params: raw.params,
    query: def.query ? parse(def.query, raw.query) : undefined,
    body: def.body ? parse(def.body, raw.body) : undefined,
    idempotencyKey: raw.idempotencyKey,
  };
  const handler = handlers[name] as Handler<RouteName>;
  const out = await handler(backend, ctx, input as HandlerInput<RouteName>);
  return { status: out.status ?? 200, body: out.body, cookies: out.cookies ?? {} };
}
