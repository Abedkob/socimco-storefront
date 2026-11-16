/**
 * Where the storefront's API lives and how the browser authenticates with it.
 *
 * - Mock (default): leave NEXT_PUBLIC_API_BASE_URL empty. The browser calls this app's own /api routes,
 *   which are served by the mock backend (src/server/backend.ts).
 * - Client API: set NEXT_PUBLIC_API_BASE_URL to the client's API origin (e.g. https://api.example.com).
 *   The browser then calls it directly, so that API must allow this site's origin (CORS) and, in
 *   cookie mode, allow credentials.
 *
 * Next.js inlines NEXT_PUBLIC_* values at build time, so they are read with literal property access.
 */

export type AuthMode = "cookie" | "bearer";
/** contract: the API speaks our contract (the mock does). custom: use adapters/custom-adapter.ts. */
export type AdapterName = "contract" | "custom";

/** Which adapter translates between the API and the storefront (NEXT_PUBLIC_API_ADAPTER). */
export function adapterNameFromEnv(value: string | undefined = process.env.NEXT_PUBLIC_API_ADAPTER): AdapterName {
  return value === "custom" ? "custom" : "contract";
}

export interface ApiConfig {
  /** Origin (and optional path prefix) of the API. Empty string = same origin as the storefront. */
  baseUrl: string;
  /** cookie: the API sets an HttpOnly session cookie. bearer: the API returns a token we send as Authorization. */
  auth: AuthMode;
  /** Abort a request after this many milliseconds. */
  timeoutMs: number;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

export function apiConfigFromEnv(env: {
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_API_AUTH?: string;
  NEXT_PUBLIC_API_TIMEOUT_MS?: string;
} = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_API_AUTH: process.env.NEXT_PUBLIC_API_AUTH,
  NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
}): ApiConfig {
  const baseUrl = (env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const auth: AuthMode = env.NEXT_PUBLIC_API_AUTH === "bearer" ? "bearer" : "cookie";
  const timeout = Number(env.NEXT_PUBLIC_API_TIMEOUT_MS);
  return {
    baseUrl,
    auth,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

/** True when the browser talks to an API on another origin rather than this app's own mock routes. */
export const isRemoteApi = (config: ApiConfig) => config.baseUrl !== "";
