import { ApiError, type RequestContext, type Role, type SessionGrant, type ShopBackend, type User } from "@/core/contract";
import { randomToken, safeEqual, sha256 } from "./crypto";
import type { SeedUser } from "./seed";
import { iso, type Deps } from "./state";

const SESSION_TTL_MS = 12 * 3_600_000;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 5;
const DUMMY_PASSWORD = "dummy-password-for-constant-time";

export function toUserView(u: SeedUser): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    company: u.company,
    role: u.role,
    addresses: structuredClone(u.addresses),
  };
}

export function issueSession({ state, now }: Deps, userId: string): SessionGrant {
  const token = randomToken();
  const expiresAtMs = now().getTime() + SESSION_TTL_MS;
  state.sessions.set(sha256(token), { userId, expiresAtMs });
  return { token, expiresAt: iso(expiresAtMs) };
}

export function currentUser({ state, now }: Deps, ctx: RequestContext): SeedUser {
  if (!ctx.sessionToken) throw new ApiError("UNAUTHENTICATED");
  const key = sha256(ctx.sessionToken);
  const session = state.sessions.get(key);
  if (!session) throw new ApiError("UNAUTHENTICATED");
  const user = state.users.get(session.userId);
  if (now().getTime() >= session.expiresAtMs || !user?.active) {
    state.sessions.delete(key);
    throw new ApiError("UNAUTHENTICATED");
  }
  return user;
}

export function requireRole(deps: Deps, ctx: RequestContext, role: Role): SeedUser {
  const user = currentUser(deps, ctx);
  if (user.role !== role) throw new ApiError("FORBIDDEN");
  return user;
}

export function createAuth(deps: Deps): ShopBackend["auth"] {
  const { state, limiter } = deps;
  return {
    async login(ctx, body) {
      const username = body.username.toLowerCase();
      const key = `login:${username}:${ctx.clientIp}`;
      limiter.assert(key, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS);

      const user = state.usersByUsername.get(username);
      const passwordOk = safeEqual(body.password, user?.password ?? DUMMY_PASSWORD);
      if (!user || !passwordOk) {
        limiter.record(key, LOGIN_WINDOW_MS);
        throw new ApiError("INVALID_CREDENTIALS");
      }
      if (!user.active) throw new ApiError("ACCOUNT_DISABLED");

      limiter.reset(key);
      return { user: toUserView(user), session: issueSession(deps, user.id) };
    },

    async logout(ctx) {
      if (ctx.sessionToken) state.sessions.delete(sha256(ctx.sessionToken));
    },

    async me(ctx) {
      return { user: toUserView(currentUser(deps, ctx)) };
    },
  };
}
