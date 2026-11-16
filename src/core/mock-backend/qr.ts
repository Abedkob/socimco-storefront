import { ApiError, type RequestContext, type ShopBackend } from "@/core/contract";
import { currentUser, issueSession, toUserView } from "./auth";
import { randomToken, safeEqual, sha256 } from "./crypto";
import { iso, type Deps, type QrRecord } from "./state";

export const QR_TTL_MS = 120_000;
const MINUTE_MS = 60_000;

export function summarizeUserAgent(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "A browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown device";
  return `${browser} on ${os}`;
}

export function createQr(deps: Deps): ShopBackend["qr"] {
  const { state, now, limiter } = deps;

  function refresh(rec: QrRecord) {
    if (["pending", "scanned", "approved"].includes(rec.status) && now().getTime() >= rec.expiresAtMs) {
      rec.status = "expired";
    }
  }

  /** The desktop proves it created this QR session by presenting the poll token cookie. */
  function ownedByDesktop(ctx: RequestContext, id: string): QrRecord {
    const rec = state.qr.get(id);
    if (!rec || !ctx.qrPollToken || !safeEqual(sha256(ctx.qrPollToken), rec.pollTokenHash)) {
      throw new ApiError("NOT_FOUND");
    }
    refresh(rec);
    return rec;
  }

  function byCode(code: string): QrRecord {
    const id = state.qrByCodeHash.get(sha256(code));
    const rec = id ? state.qr.get(id) : undefined;
    if (!rec) throw new ApiError("NOT_FOUND");
    refresh(rec);
    if (rec.status === "expired") throw new ApiError("QR_EXPIRED");
    return rec;
  }

  return {
    async create(ctx) {
      limiter.hit(`qr-create:${ctx.clientIp}`, 10, MINUTE_MS);
      const id = `qr_${randomToken(12)}`;
      const code = randomToken();
      const pollToken = randomToken();
      const createdAtMs = now().getTime();
      const rec: QrRecord = {
        id,
        codeHash: sha256(code),
        pollTokenHash: sha256(pollToken),
        status: "pending",
        createdAtMs,
        expiresAtMs: createdAtMs + QR_TTL_MS,
        desktopUserAgent: ctx.userAgent,
        scannedByUserId: null,
        approvedByUserId: null,
      };
      state.qr.set(id, rec);
      state.qrByCodeHash.set(rec.codeHash, id);
      const approveUrl = `${ctx.origin}/qr/approve?code=${encodeURIComponent(code)}`;
      return { id, approveUrl, expiresAt: iso(rec.expiresAtMs), pollToken };
    },

    async status(ctx, id) {
      limiter.hit(`qr-poll:${ctx.qrPollToken ? sha256(ctx.qrPollToken) : ctx.clientIp}`, 40, MINUTE_MS);
      const rec = ownedByDesktop(ctx, id);
      return { status: rec.status, expiresAt: iso(rec.expiresAtMs) };
    },

    async scan(ctx, body) {
      const user = currentUser(deps, ctx);
      limiter.hit(`qr-phone:${user.id}`, 10, MINUTE_MS);
      const rec = byCode(body.code);
      const scannedBySomeoneElse = rec.status === "scanned" && rec.scannedByUserId !== user.id;
      if (rec.status !== "pending" && (rec.status !== "scanned" || scannedBySomeoneElse)) {
        throw new ApiError("QR_ALREADY_USED");
      }
      rec.status = "scanned";
      rec.scannedByUserId = user.id;
      return { requestedFrom: summarizeUserAgent(rec.desktopUserAgent), requestedAt: iso(rec.createdAtMs) };
    },

    async approve(ctx, body) {
      const user = currentUser(deps, ctx);
      limiter.hit(`qr-phone:${user.id}`, 10, MINUTE_MS);
      const rec = byCode(body.code);
      if (rec.status === "pending") throw new ApiError("FORBIDDEN", { message: "Scan the code before approving." });
      if (rec.status !== "scanned") throw new ApiError("QR_ALREADY_USED");
      if (rec.scannedByUserId !== user.id) throw new ApiError("FORBIDDEN");
      if (body.decision === "approve") {
        rec.status = "approved";
        rec.approvedByUserId = user.id;
        return { status: "approved" };
      }
      rec.status = "denied";
      return { status: "denied" };
    },

    async consume(ctx, id) {
      limiter.hit(`qr-consume:${ctx.clientIp}`, 10, MINUTE_MS);
      const rec = ownedByDesktop(ctx, id);
      if (rec.status === "expired") throw new ApiError("QR_EXPIRED");
      if (rec.status === "consumed" || rec.status === "denied") throw new ApiError("QR_ALREADY_USED");
      if (rec.status !== "approved" || !rec.approvedByUserId) {
        throw new ApiError("FORBIDDEN", { message: "This login hasn't been approved yet." });
      }
      const user = state.users.get(rec.approvedByUserId);
      if (!user?.active) throw new ApiError("ACCOUNT_DISABLED");
      rec.status = "consumed";
      return { user: toUserView(user), session: issueSession(deps, user.id) };
    },
  };
}
