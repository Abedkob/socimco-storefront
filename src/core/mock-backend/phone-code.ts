import { ApiError, type RequestContext, type ShopBackend } from "@/core/contract";
import { currentUser, issueSession, toUserView } from "./auth";
import { randomToken, safeEqual, sha256 } from "./crypto";
import { QR_TTL_MS, summarizeUserAgent } from "./qr";
import { iso, type Deps, type PhoneCodeRecord } from "./state";

const MINUTE_MS = 60_000;

/**
 * Phone sign-in, the reverse of QR login: a signed-in computer shows a code, and a signed-out phone scans it.
 *   requireApproval = false: redeeming the code signs the phone in at once.
 *   requireApproval = true:  redeeming binds the phone (poll token) and waits; the computer approves or denies;
 *                            the phone then completes and gets its session.
 * Codes are random, single use and valid for 2 minutes, like QR login codes.
 */
export function createPhoneCode(deps: Deps): ShopBackend["phoneCode"] {
  const { state, now, limiter } = deps;

  function refresh(rec: PhoneCodeRecord) {
    if (["pending", "scanned", "approved"].includes(rec.status) && now().getTime() >= rec.expiresAtMs) {
      rec.status = "expired";
    }
  }

  /** The computer that created the code: same signed-in user. Anyone else gets NOT_FOUND. */
  function ownedByUser(ctx: RequestContext, id: string): PhoneCodeRecord {
    const user = currentUser(deps, ctx);
    const rec = state.phoneCodes.get(id);
    if (!rec || rec.ownerUserId !== user.id) throw new ApiError("NOT_FOUND");
    refresh(rec);
    return rec;
  }

  /** The phone that redeemed the code, proven by its poll token cookie. */
  function boundToPhone(ctx: RequestContext, id: string): PhoneCodeRecord {
    const rec = state.phoneCodes.get(id);
    if (!rec || !rec.phonePollTokenHash || !ctx.qrPollToken || !safeEqual(sha256(ctx.qrPollToken), rec.phonePollTokenHash)) {
      throw new ApiError("NOT_FOUND");
    }
    refresh(rec);
    return rec;
  }

  function signInPhone(rec: PhoneCodeRecord) {
    const user = state.users.get(rec.ownerUserId);
    if (!user?.active) throw new ApiError("ACCOUNT_DISABLED");
    rec.status = "consumed";
    return { user: toUserView(user), session: issueSession(deps, user.id) };
  }

  return {
    async create(ctx, body) {
      const user = currentUser(deps, ctx);
      limiter.hit(`phone-create:${user.id}`, 10, MINUTE_MS);
      const id = `pc_${randomToken(12)}`;
      const code = randomToken();
      const createdAtMs = now().getTime();
      const rec: PhoneCodeRecord = {
        id,
        codeHash: sha256(code),
        ownerUserId: user.id,
        requireApproval: body.requireApproval,
        status: "pending",
        createdAtMs,
        expiresAtMs: createdAtMs + QR_TTL_MS,
        phonePollTokenHash: null,
        phoneUserAgent: null,
      };
      state.phoneCodes.set(id, rec);
      state.phoneCodeByCodeHash.set(rec.codeHash, id);
      const scanUrl = `${ctx.origin}/qr/sign-in?code=${encodeURIComponent(code)}`;
      return { id, scanUrl, expiresAt: iso(rec.expiresAtMs), requireApproval: rec.requireApproval };
    },

    async status(ctx, id) {
      limiter.hit(`phone-status:${id}`, 40, MINUTE_MS);
      const rec = ownedByUser(ctx, id);
      return {
        status: rec.status,
        expiresAt: iso(rec.expiresAtMs),
        requestedFrom: rec.phoneUserAgent === null ? null : summarizeUserAgent(rec.phoneUserAgent),
      };
    },

    async decide(ctx, id, body) {
      const rec = ownedByUser(ctx, id);
      if (rec.status === "expired") throw new ApiError("QR_EXPIRED");
      if (rec.status === "pending") throw new ApiError("FORBIDDEN", { message: "No phone has scanned this code yet." });
      if (rec.status !== "scanned") throw new ApiError("QR_ALREADY_USED");
      const status = body.decision === "approve" ? "approved" : "denied";
      rec.status = status;
      return { status };
    },

    async redeem(ctx, body) {
      limiter.hit(`phone-redeem:${ctx.clientIp}`, 10, MINUTE_MS);
      const id = state.phoneCodeByCodeHash.get(sha256(body.code));
      const rec = id ? state.phoneCodes.get(id) : undefined;
      if (!rec) throw new ApiError("NOT_FOUND");
      refresh(rec);
      if (rec.status === "expired") throw new ApiError("QR_EXPIRED");
      if (rec.status !== "pending") throw new ApiError("QR_ALREADY_USED");

      if (!rec.requireApproval) return { status: "signed_in", ...signInPhone(rec) };

      const pollToken = randomToken();
      rec.status = "scanned";
      rec.phonePollTokenHash = sha256(pollToken);
      rec.phoneUserAgent = ctx.userAgent;
      return { status: "awaiting_approval", id: rec.id, expiresAt: iso(rec.expiresAtMs), pollToken };
    },

    async progress(ctx, id) {
      limiter.hit(`phone-progress:${id}`, 40, MINUTE_MS);
      const rec = boundToPhone(ctx, id);
      return { status: rec.status, expiresAt: iso(rec.expiresAtMs) };
    },

    async complete(ctx, id) {
      const rec = boundToPhone(ctx, id);
      if (rec.status === "expired") throw new ApiError("QR_EXPIRED");
      if (rec.status === "consumed" || rec.status === "denied") throw new ApiError("QR_ALREADY_USED");
      if (rec.status !== "approved") throw new ApiError("FORBIDDEN", { message: "The computer hasn't approved this phone yet." });
      return signInPhone(rec);
    },
  };
}
