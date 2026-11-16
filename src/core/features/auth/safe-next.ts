/**
 * Where to go after signing in. Only same-site paths are allowed ("/orders", "/qr/approve?code=…"),
 * so a crafted link like /login?next=https://evil.example or //evil.example can't bounce the customer off-site.
 */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw === "/login" || raw.startsWith("/login?") || raw.startsWith("/login/")) return fallback;
  return raw;
}
