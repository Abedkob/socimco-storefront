import { headers } from "next/headers";
import type { RequestContext, ShopBackend } from "@/core/contract";
import { contextFromHeaders } from "./http";

type Bound<T> = {
  [K in keyof T]: {
    [M in keyof T[K]]: T[K][M] extends (ctx: RequestContext, ...args: infer A) => infer R ? (...args: A) => R : never;
  };
};

/** The backend with the current request's context already applied. */
export type ServerApi = Bound<ShopBackend>;

export function bindBackend(backend: ShopBackend, ctx: RequestContext): ServerApi {
  const bound: Record<string, Record<string, unknown>> = {};
  for (const [ns, methods] of Object.entries(backend)) {
    bound[ns] = {};
    for (const [name, fn] of Object.entries(methods as Record<string, (...a: unknown[]) => unknown>)) {
      bound[ns][name] = (...args: unknown[]) => fn(ctx, ...args);
    }
  }
  return bound as ServerApi;
}

/** For Server Components: binds the backend to the incoming request's cookies and headers. */
export function createServerApi(backend: ShopBackend) {
  return async function getServerApi(): Promise<ServerApi> {
    return bindBackend(backend, contextFromHeaders(await headers()));
  };
}
