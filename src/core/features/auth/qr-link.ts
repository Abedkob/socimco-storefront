/** The two kinds of sign-in link a QR code can carry. */
export const QR_PATHS = {
  /** Shown by a computer that wants to sign in; scanned by a signed-in phone, which approves it. */
  approveComputer: "/qr/approve",
  /** Shown by a signed-in computer; scanned by a signed-out phone, which signs in with it. */
  signInPhone: "/qr/sign-in",
} as const;
export type QrPath = (typeof QR_PATHS)[keyof typeof QR_PATHS];

/**
 * Pulls the sign-in code out of a scanned QR. Only this site's own links of the expected kind are accepted,
 * so a code from another site (or any other QR) is never sent to the API.
 */
export function codeFromScan(text: string, origin: string, path: QrPath = QR_PATHS.approveComputer): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.origin !== origin || url.pathname !== path) return null;
  const code = url.searchParams.get("code")?.trim();
  return code || null;
}
