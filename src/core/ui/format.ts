const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const moneyWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const count = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export const formatMoney = (cents: number) => money.format(cents / 100);
/** For large round amounts in headlines, e.g. "$34,000". */
export const formatMoneyShort = (cents: number) =>
  cents % 100 === 0 ? moneyWhole.format(cents / 100) : money.format(cents / 100);
export const formatCount = (n: number) => count.format(n);
export const formatDate = (iso: string) => date.format(new Date(iso));

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, "0")}m` : `${minutes}m`;
}

export const unitLabel = (unit: string, quantity = 2) =>
  ({ piece: quantity === 1 ? "piece" : "pcs", box: quantity === 1 ? "box" : "boxes", meter: "m" })[unit] ?? unit;

export const toCents = (dollars: string): number | null => {
  const cleaned = dollars.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
};

export const centsToInput = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
