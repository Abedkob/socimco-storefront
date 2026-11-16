/*
 * The storefront is French only: every number, amount and date is formatted for fr-FR.
 * The currency comes from NEXT_PUBLIC_CURRENCY (ISO code, compiled in at build time); the demo data is in USD.
 *   USD → 40 000,00 $US     EUR → 40 000,00 €     MAD → 40 000,00 MAD
 */
export const LOCALE = "fr-FR";
export const CURRENCY = (process.env.NEXT_PUBLIC_CURRENCY ?? "").trim().toUpperCase() || "USD";

const money = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY });
const moneyWhole = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const count = new Intl.NumberFormat(LOCALE);
const date = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const dayTime = new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The currency sign as French formatting shows it ("$US", "€", "MAD"), e.g. next to price inputs. */
export const CURRENCY_SYMBOL = money.formatToParts(0).find((p) => p.type === "currency")?.value ?? CURRENCY;

export const formatMoney = (cents: number) => money.format(cents / 100);
/** For large round amounts in headlines, e.g. "34 000 $US". */
export const formatMoneyShort = (cents: number) =>
  cents % 100 === 0 ? moneyWhole.format(cents / 100) : money.format(cents / 100);
export const formatCount = (n: number) => count.format(n);
/** "16 nov. 2026" */
export const formatDate = (iso: string) => date.format(new Date(iso));
/** "15:15" */
export const formatTime = (iso: string) => time.format(new Date(iso));
/** "lun. 16 nov., 15:15" */
export const formatDayTime = (iso: string) => dayTime.format(new Date(iso));

/** "23 h 59 min", "12 min", or "Expiré". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expiré";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
}

export const unitLabel = (unit: string, quantity = 2) =>
  ({ piece: quantity === 1 ? "pièce" : "pièces", box: quantity === 1 ? "boîte" : "boîtes", meter: "m" })[unit] ?? unit;

/**
 * Parses a price typed by the customer into cents. Accepts the French decimal comma and spaces
 * ("85,50", "1 234,5"), a dot ("85.50"), and a stray currency sign. Returns null if it isn't a price.
 */
export const toCents = (typed: string): number | null => {
  const cleaned = typed
    .replace(/[\s  ]/g, "")
    .replace(/[^\d.,]/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
};

/** Cents as the customer would type them: "85" or "85,50". */
export const centsToInput = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ","));
