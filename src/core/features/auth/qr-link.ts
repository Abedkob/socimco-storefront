/**
 * Pulls the sign-in code out of a scanned QR. Only this site's own /qr/approve links are accepted,
 * so a code from another site (or any other QR) is never sent to the API.
 */
export function codeFromScan(text: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.origin !== origin || !url.pathname.endsWith("/qr/approve")) return null;
  const code = url.searchParams.get("code")?.trim();
  return code || null;
}
