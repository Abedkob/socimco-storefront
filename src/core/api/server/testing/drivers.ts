import {
  ApiError,
  apiRoutes,
  buildPath,
  ERROR_STATUS,
  ErrorEnvelope,
  QR_POLL_COOKIE,
  SESSION_COOKIE,
  type RequestContext,
  type RouteName,
  type RouteResponse,
  type ShopBackend,
} from "@/core/contract";
import type { Actor, CallInput, Driver } from "@/core/contract/testing/driver";
import { executeRoute, type CookieEffects } from "../execute";
import { createApiRoute } from "../http";

export const TEST_START = Date.parse("2026-11-15T10:00:00Z");
export const TEST_ORIGIN = "http://localhost:3001";

export type BackendFactory = (now: () => Date) => ShopBackend;

function checkResponse<R extends RouteName>(route: R, body: unknown): RouteResponse<R> {
  return apiRoutes[route].response.parse(body) as RouteResponse<R>;
}

function clock() {
  let t = TEST_START;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

function applyCookies(jar: Actor["cookies"], effects: CookieEffects) {
  if (effects.session !== undefined) jar.session = effects.session?.token ?? null;
  if (effects.qrPoll !== undefined) jar.qrPoll = effects.qrPoll?.token ?? null;
}

/** Calls the backend through executeRoute: input validation and dispatch, no HTTP. */
export function createDirectDriver(makeBackend: BackendFactory): Driver {
  const c = clock();
  const backend = makeBackend(() => new Date(c.now()));
  return {
    now: c.now,
    advance: c.advance,
    actor({ ip = "10.9.9.9", userAgent = "contract-test" } = {}) {
      const actor: Actor = {
        cookies: { session: null, qrPoll: null },
        async call(route, input = {}) {
          const ctx: RequestContext = {
            sessionToken: actor.cookies.session,
            qrPollToken: actor.cookies.qrPoll,
            clientIp: ip,
            userAgent,
            origin: TEST_ORIGIN,
          };
          const result = await executeRoute(backend, route, ctx, {
            params: (input.params ?? {}) as Record<string, string>,
            query: (input.query ?? {}) as Record<string, string>,
            body: input.body,
            idempotencyKey: input.idempotencyKey ?? null,
          });
          applyCookies(actor.cookies, result.cookies);
          return checkResponse(route, JSON.parse(JSON.stringify(result.body)));
        },
      };
      return actor;
    },
  };
}

function readSetCookies(headers: Headers, jar: Actor["cookies"]) {
  for (const line of headers.getSetCookie()) {
    const [pair, ...attrs] = line.split(";");
    const i = pair.indexOf("=");
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    const cleared = attrs.some((a) => a.trim().toLowerCase() === "max-age=0");
    if (name === SESSION_COOKIE) jar.session = cleared ? null : value;
    if (name === QR_POLL_COOKIE) jar.qrPoll = cleared ? null : value;
  }
}

export interface RestDriver extends Driver {
  handler: ReturnType<typeof createApiRoute>;
}

/** Calls the Next.js route handler with real Request/Response objects. */
export function createRestDriver(makeBackend: BackendFactory): RestDriver {
  const c = clock();
  const handler = createApiRoute(makeBackend(() => new Date(c.now())), { now: c.now });
  return {
    handler,
    now: c.now,
    advance: c.advance,
    actor({ ip = "10.9.9.9", userAgent = "contract-test" } = {}) {
      const actor: Actor = {
        cookies: { session: null, qrPoll: null },
        async call<R extends RouteName>(route: R, input: CallInput<R> = {}) {
          const def = apiRoutes[route];
          const url = new URL(buildPath(def.path, (input.params ?? {}) as Record<string, string>), TEST_ORIGIN);
          for (const [k, v] of Object.entries((input.query ?? {}) as Record<string, unknown>)) {
            if (v !== undefined) url.searchParams.set(k, String(v));
          }
          const headers = new Headers({ "user-agent": userAgent, "x-forwarded-for": ip, origin: TEST_ORIGIN });
          const cookie = [
            actor.cookies.session && `${SESSION_COOKIE}=${actor.cookies.session}`,
            actor.cookies.qrPoll && def.path.startsWith("/api/auth/qr") && `${QR_POLL_COOKIE}=${actor.cookies.qrPoll}`,
          ]
            .filter(Boolean)
            .join("; ");
          if (cookie) headers.set("cookie", cookie);
          if (input.idempotencyKey) headers.set("idempotency-key", input.idempotencyKey);
          const hasBody = "body" in def;
          if (hasBody) headers.set("content-type", "application/json");

          const request = new Request(url, {
            method: def.method,
            headers,
            body: hasBody ? JSON.stringify(input.body ?? {}) : undefined,
          });
          const response = await handler[def.method](request);
          readSetCookies(response.headers, actor.cookies);
          const json: unknown = await response.json();

          if (!response.ok) {
            const { error } = ErrorEnvelope.parse(json);
            if (response.status !== ERROR_STATUS[error.code]) {
              throw new Error(`${route}: ${error.code} came back as HTTP ${response.status}`);
            }
            throw new ApiError(error.code, { message: error.message, details: error.details });
          }
          return checkResponse(route, json);
        },
      };
      return actor;
    },
  };
}
