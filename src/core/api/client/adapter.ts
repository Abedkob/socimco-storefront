import type { ApiError, HttpMethod, RouteName } from "@/core/contract";

/** The storefront never calls the sales-desk routes; those stay server-side (mock backend and tests). */
export type StorefrontRoute = Exclude<RouteName, "sellerNegotiations" | "sellerNegotiation" | "sellerRound">;

export interface EndpointOverride {
  method?: HttpMethod;
  /** Path on the API, with :params, e.g. "/v1/catalog/items/:slug". */
  path: string;
}

/** Makes one request to the client's API (base URL, auth, timeout and error mapping included) and returns its JSON. */
export type AdapterRequest = (
  path: string,
  init?: { method?: HttpMethod; query?: Record<string, unknown>; body?: unknown; headers?: Record<string, string>; idempotencyKey?: string },
) => Promise<unknown>;

/** What a custom route handler receives: our validated input, plus helpers to call their API. */
export interface RouteHandlerInput {
  params: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  idempotencyKey?: string;
}
export interface RouteHandlerTools {
  request: AdapterRequest;
  /** Bearer auth only: store / forget the session token their login returns. */
  setToken: (token: string) => void;
  clearToken: () => void;
}
/** Returns our contract's response shape for that route; it is validated automatically afterwards. */
export type RouteHandler = (input: RouteHandlerInput, tools: RouteHandlerTools) => Promise<unknown>;

/**
 * Everything that differs between our contract and the client's API lives here.
 * See src/core/api/README.md for the full guide and src/core/api/client/adapters/custom-adapter.ts for the template.
 *
 * With no adapter (the default) the client speaks our contract exactly: that is what the mock serves.
 *   endpoints    → their URL (and method) for a route, when only the URL differs
 *   toRequest    → reshape our request body/query into theirs
 *   fromResponse → reshape their JSON into our contract's response (validated afterwards)
 *   toError      → turn their error JSON into one of our ApiError codes
 *   readToken    → bearer auth: pull the session token out of a login response
 *   handlers     → a fully custom route: several calls, combined data, anything 1:1 mapping can't do
 */
export interface ApiAdapter {
  endpoints?: Partial<Record<StorefrontRoute, EndpointOverride>>;
  toRequest?: (route: StorefrontRoute, input: { body?: unknown; query?: Record<string, unknown> }) => {
    body?: unknown;
    query?: Record<string, unknown>;
  };
  fromResponse?: (route: StorefrontRoute, json: unknown) => unknown;
  toError?: (status: number, json: unknown) => ApiError | null;
  readToken?: (route: StorefrontRoute, json: unknown, headers: Headers) => string | null;
  handlers?: Partial<Record<StorefrontRoute, RouteHandler>>;
}

/** Our own contract: no reshaping. Used for the mock and for any API that implements our contract. */
export const contractAdapter: ApiAdapter = {
  readToken: (_route, json) => {
    const token = (json as { token?: unknown } | null)?.token;
    return typeof token === "string" ? token : null;
  },
};
