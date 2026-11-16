import {
  ApiError,
  apiRoutes,
  IDEMPOTENCY_HEADER,
  isApiError,
  QR_POLL_COOKIE,
  QR_POLL_COOKIE_PATH,
  SESSION_COOKIE,
  type RequestContext,
  type RouteName,
  type ShopBackend,
} from "@/core/contract";
import { executeRoute, type CookieEffects } from "./execute";

interface CompiledRoute {
  name: RouteName;
  method: string;
  segments: string[];
  paramCount: number;
}

const compiled: CompiledRoute[] = (Object.keys(apiRoutes) as RouteName[])
  .map((name) => {
    const segments = apiRoutes[name].path.split("/").filter(Boolean);
    return {
      name,
      method: apiRoutes[name].method,
      segments,
      paramCount: segments.filter((s) => s.startsWith(":")).length,
    };
  })
  .sort((a, b) => a.paramCount - b.paramCount);

export function matchRoute(method: string, pathname: string): { name: RouteName; params: Record<string, string> } | null {
  const parts = pathname.split("/").filter(Boolean);
  for (const route of compiled) {
    if (route.method !== method || route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const ok = route.segments.every((seg, i) => {
      if (!seg.startsWith(":")) return seg === parts[i];
      try {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
        return true;
      } catch {
        return false;
      }
    });
    if (ok) return { name: route.name, params };
  }
  return null;
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function publicHost(h: Headers, fallback: string): string {
  return h.get("x-forwarded-host") ?? h.get("host") ?? fallback;
}

/**
 * Builds the backend context from request headers.
 * x-forwarded-* headers are only trustworthy behind a proxy that sets them;
 * a production backend must enforce its own rate limits.
 */
export function contextFromHeaders(h: Headers, fallbackUrl = "http://localhost"): RequestContext {
  const url = new URL(fallbackUrl);
  const cookies = parseCookies(h.get("cookie"));
  const protocol = h.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return {
    sessionToken: cookies[SESSION_COOKIE] || null,
    qrPollToken: cookies[QR_POLL_COOKIE] || null,
    clientIp: h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent") ?? "",
    origin: `${protocol}://${publicHost(h, url.host)}`,
  };
}

function cookieHeaders(effects: CookieEffects, secure: boolean, nowMs: number): string[] {
  const flags = (path: string, sameSite: "Lax" | "Strict") =>
    `Path=${path}; HttpOnly; SameSite=${sameSite}${secure ? "; Secure" : ""}`;
  const maxAge = (expiresAt: string) => Math.max(0, Math.floor((Date.parse(expiresAt) - nowMs) / 1000));
  const out: string[] = [];
  if (effects.session === null) out.push(`${SESSION_COOKIE}=; ${flags("/", "Lax")}; Max-Age=0`);
  else if (effects.session) {
    out.push(`${SESSION_COOKIE}=${effects.session.token}; ${flags("/", "Lax")}; Max-Age=${maxAge(effects.session.expiresAt)}`);
  }
  if (effects.qrPoll === null) out.push(`${QR_POLL_COOKIE}=; ${flags(QR_POLL_COOKIE_PATH, "Strict")}; Max-Age=0`);
  else if (effects.qrPoll) {
    out.push(
      `${QR_POLL_COOKIE}=${effects.qrPoll.token}; ${flags(QR_POLL_COOKIE_PATH, "Strict")}; Max-Age=${maxAge(effects.qrPoll.expiresAt)}`,
    );
  }
  return out;
}

function json(status: number, body: unknown, extra?: Headers): Response {
  const headers = extra ?? new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(error: unknown, hadSession: boolean, secure: boolean): Response {
  const apiError = isApiError(error) ? error : new ApiError("INTERNAL");
  if (!isApiError(error)) console.error("[api] unexpected error", error);
  const headers = new Headers();
  const retryAfter = (apiError.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  if (apiError.code === "RATE_LIMITED" && retryAfter) headers.set("retry-after", String(retryAfter));
  if (apiError.code === "UNAUTHENTICATED" && hadSession) {
    for (const c of cookieHeaders({ session: null }, secure, 0)) headers.append("set-cookie", c);
  }
  return json(apiError.status, apiError.toEnvelope(), headers);
}

export interface ApiRouteOptions {
  now?: () => number;
}

/** Next.js catch-all route handler for /api/*. Uses only Web Request/Response. */
export function createApiRoute(backend: ShopBackend, options: ApiRouteOptions = {}) {
  const now = options.now ?? Date.now;

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const ctx = contextFromHeaders(request.headers, request.url);
    const secure = ctx.origin.startsWith("https:");
    try {
      const match = matchRoute(request.method, url.pathname);
      if (!match) throw new ApiError("NOT_FOUND");
      const def = apiRoutes[match.name];

      if (request.method !== "GET") {
        const origin = request.headers.get("origin");
        if (!origin || origin !== ctx.origin) throw new ApiError("FORBIDDEN", { message: "Requête d'origine externe bloquée." });
      }

      let body: unknown;
      if ("body" in def) {
        if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
          throw new ApiError("VALIDATION_FAILED", { message: "Envoyez un corps de requête JSON." });
        }
        try {
          body = await request.json();
        } catch {
          throw new ApiError("VALIDATION_FAILED", { message: "Corps de requête JSON mal formé." });
        }
      }

      const query = Object.fromEntries([...url.searchParams].filter(([, v]) => v !== ""));
      const result = await executeRoute(backend, match.name, ctx, {
        params: match.params,
        query,
        body,
        idempotencyKey: request.headers.get(IDEMPOTENCY_HEADER),
      });
      const headers = new Headers();
      for (const c of cookieHeaders(result.cookies, secure, now())) headers.append("set-cookie", c);
      return json(result.status, result.body, headers);
    } catch (error) {
      return errorResponse(error, ctx.sessionToken !== null, secure);
    }
  }

  return { GET: handle, POST: handle, PATCH: handle, DELETE: handle };
}
