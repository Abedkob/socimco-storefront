import {
  ApiError,
  apiRoutes,
  buildPath,
  ERROR_STATUS,
  ErrorEnvelope,
  IDEMPOTENCY_HEADER,
  type ErrorCode,
  type HttpMethod,
  type RouteBody,
  type RouteParams,
  type RouteQuery,
  type RouteResponse,
} from "@/core/contract";
import { contractAdapter, type AdapterRequest, type ApiAdapter, type StorefrontRoute } from "./adapter";
import type { ApiConfig } from "./config";
import { createTokenStore, type TokenStore } from "./token-store";

export interface CallInput<R extends StorefrontRoute> {
  params?: RouteParams<R>;
  query?: RouteQuery<R>;
  body?: RouteBody<R>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export interface HttpClientOptions extends ApiConfig {
  adapter?: ApiAdapter;
  /** Injectable for tests and SSR; defaults to the global fetch. */
  fetch?: typeof fetch;
  tokens?: TokenStore;
}

export interface HttpClient {
  call<R extends StorefrontRoute>(route: R, input?: CallInput<R>): Promise<RouteResponse<R>>;
  readonly config: ApiConfig;
  readonly tokens: TokenStore;
}

/** Status codes we can interpret even when the API's error body isn't in our envelope format. */
const STATUS_FALLBACK: Record<number, ErrorCode> = {
  400: "VALIDATION_FAILED",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  410: "QR_EXPIRED",
  422: "VALIDATION_FAILED",
  429: "RATE_LIMITED",
};

/** Routes whose success signs this browser in (bearer mode reads the token from their response). */
const LOGIN_ROUTES = new Set<StorefrontRoute>(["login", "qrConsume", "phoneSignIn", "phoneSignInComplete"]);

function toApiError(status: number, json: unknown, adapter: ApiAdapter, route: StorefrontRoute): ApiError {
  const custom = adapter.toError?.(status, json);
  if (custom) return custom;
  const parsed = ErrorEnvelope.safeParse(json);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(code, { message, details });
  }
  const code = STATUS_FALLBACK[status] ?? "INTERNAL";
  return new ApiError(code, { details: { route, status, body: json } });
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const adapter = options.adapter ?? contractAdapter;
  const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const tokens = options.tokens ?? createTokenStore();
  const config: ApiConfig = { baseUrl: options.baseUrl, auth: options.auth, timeoutMs: options.timeoutMs };

  /**
   * One HTTP request to the API: URL, auth header, timeout, JSON parsing and error mapping.
   * Used for every normal route and exposed to custom route handlers as `request()`.
   */
  async function send(
    route: StorefrontRoute,
    req: { method: HttpMethod; path: string; query?: Record<string, unknown>; body?: unknown; headers?: Record<string, string>; idempotencyKey?: string },
    signal?: AbortSignal,
  ): Promise<{ json: unknown; headers: Headers }> {
    const url = new URL(`${config.baseUrl}${req.path}`, config.baseUrl ? undefined : (globalThis.location?.origin ?? "http://localhost"));
    for (const [k, v] of Object.entries(req.query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));

    const headers = new Headers({ accept: "application/json", ...req.headers });
    if (req.body !== undefined) headers.set("content-type", "application/json");
    if (req.idempotencyKey) headers.set(IDEMPOTENCY_HEADER, req.idempotencyKey);
    const token = config.auth === "bearer" ? tokens.get() : null;
    if (token) headers.set("authorization", `Bearer ${token}`);

    // Timeout, combined with the caller's own signal (e.g. React Query cancelling a stale request).
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), config.timeoutMs);
    const onAbort = () => timeout.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    let response: Response;
    try {
      response = await doFetch(url.toString(), {
        method: req.method,
        headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        credentials: config.auth === "cookie" ? "include" : "omit",
        signal: timeout.signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      const timedOut = timeout.signal.aborted;
      throw new ApiError("INTERNAL", {
        message: timedOut ? "The server took too long to answer. Try again." : "Can't reach the server. Check your connection and try again.",
        details: { route, kind: timedOut ? "timeout" : "network" },
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }

    if (!response.ok) {
      const error = toApiError(response.status, json, adapter, route);
      if (error.code === "UNAUTHENTICATED") tokens.clear();
      throw error;
    }
    return { json, headers: response.headers };
  }

  async function call<R extends StorefrontRoute>(route: R, input: CallInput<R> = {}): Promise<RouteResponse<R>> {
    const def = apiRoutes[route];

    // Validate and normalise our side first: a bad call fails here, not on the server.
    let body: unknown = undefined;
    if ("body" in def) {
      const checked = def.body.safeParse(input.body ?? {});
      if (!checked.success) throw new ApiError("VALIDATION_FAILED", { details: { route, issues: checked.error.issues } });
      body = checked.data;
    }
    let query: Record<string, unknown> | undefined = undefined;
    if ("query" in def) {
      const checked = def.query.safeParse(input.query ?? {});
      if (!checked.success) throw new ApiError("VALIDATION_FAILED", { details: { route, issues: checked.error.issues } });
      query = checked.data as Record<string, unknown>;
    }
    const params = (input.params ?? {}) as Record<string, string>;

    let shaped: unknown;
    const handler = adapter.handlers?.[route];
    if (handler) {
      // Fully custom route: the adapter makes whatever calls it needs and returns our contract's shape.
      const request: AdapterRequest = async (path, init = {}) =>
        (await send(route, { method: init.method ?? "GET", path, query: init.query, body: init.body, headers: init.headers, idempotencyKey: init.idempotencyKey }, input.signal)).json;
      shaped = await handler({ params, query, body, idempotencyKey: input.idempotencyKey }, { request, setToken: tokens.set, clearToken: tokens.clear });
    } else {
      const override = adapter.endpoints?.[route];
      if (adapter.toRequest) ({ body, query } = adapter.toRequest(route, { body, query }));
      const { json, headers } = await send(
        route,
        { method: override?.method ?? def.method, path: buildPath(override?.path ?? def.path, params), query, body, idempotencyKey: input.idempotencyKey },
        input.signal,
      );
      if (config.auth === "bearer" && LOGIN_ROUTES.has(route)) {
        const next = adapter.readToken?.(route, json, headers) ?? null;
        if (next) tokens.set(next);
      }
      shaped = adapter.fromResponse ? adapter.fromResponse(route, json) : json;
    }
    if (config.auth === "bearer" && route === "logout") tokens.clear();

    const checked = def.response.safeParse(shaped);
    if (!checked.success) {
      // Contract drift: the API answered, but not in the shape the storefront relies on.
      console.error(`[api] ${route} returned an unexpected shape`, checked.error.issues);
      throw new ApiError("INTERNAL", {
        message: "The server sent an unexpected response. Try again later.",
        details: { route, kind: "contract", issues: checked.error.issues },
      });
    }
    return checked.data as RouteResponse<R>;
  }

  return { call, config, tokens };
}

/** The HTTP status our contract uses for an error code (handy for adapters mapping the client's errors). */
export const statusOf = (code: ErrorCode) => ERROR_STATUS[code];
