import type { RouteBody, RouteName, RouteParams, RouteQuery, RouteResponse } from "../routes";

export interface CallInput<R extends RouteName> {
  params?: RouteParams<R>;
  query?: RouteQuery<R>;
  body?: RouteBody<R>;
  idempotencyKey?: string;
}

/** One browser-like client with its own cookie jar. Calls reject with ApiError on failure. */
export interface Actor {
  call<R extends RouteName>(route: R, input?: CallInput<R>): Promise<RouteResponse<R>>;
  cookies: { session: string | null; qrPoll: string | null };
}

export interface Driver {
  actor(options?: { ip?: string; userAgent?: string }): Actor;
  now(): number;
  advance(ms: number): void;
}

export type DriverFactory = () => Driver;
