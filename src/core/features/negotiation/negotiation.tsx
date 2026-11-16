"use client";

import { AlertTriangle, ArrowRight, Check, ChevronRight, Clock, FileText, Lock, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, type FormEvent } from "react";
import { useCart, useNegotiation, useNegotiationActions } from "@/core/api/client/react";
import { isApiError, lastCustomerOffer, lastSellerPrice, type Cart, type Negotiation } from "@/core/contract";
import { BASE, btn, ErrorTile, errorMessage, Eyebrow, formatCount, formatCountdown, formatMoney, ProductImage, Spinner, TILE, useCountdown, useToast } from "@/core/ui";
import { useOfferForm, type OfferForm } from "./offer";
import { isQuoteClosed, maxOffers, quoteRef, quoteTotals, rememberQuote, useRememberedQuote } from "./quote";

const STAMP: Record<Negotiation["status"], { label: string; tone: string }> = {
  awaiting_seller: { label: "Awaiting seller", tone: "bg-surface text-ink" },
  awaiting_customer: { label: "Your move", tone: "bg-accent text-accent-ink" },
  accepted: { label: "Price agreed", tone: "bg-success-soft text-success" },
  rejected: { label: "Declined", tone: "bg-danger-soft text-danger" },
  expired: { label: "Expired", tone: "bg-surface text-ink-2" },
  cancelled: { label: "Cancelled", tone: "bg-surface text-ink-2" },
  ordered: { label: "Ordered", tone: "bg-success-soft text-success" },
};

type Images = Map<string, string>;

/** Runs a quote action and reports the outcome as a toast. */
function useRun() {
  const { notify } = useToast();
  return <T,>(promise: Promise<T>, ok: string, then?: (value: T) => void) =>
    promise.then(
      (value) => {
        notify(ok);
        then?.(value);
      },
      (e: unknown) => notify(errorMessage(e), "danger"),
    );
}

function Stamp({ status }: { status: Negotiation["status"] }) {
  const s = STAMP[status];
  return <span className={`inline-flex h-9 items-center rounded-full px-4 text-[13px] font-bold ${s.tone}`}>{s.label}</span>;
}

function OffersLeft({ left, max }: { left: number; max: number }) {
  return (
    <span className="flex items-center gap-2 text-sm text-ink-2">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`size-2.5 rounded-full ${i < left ? "bg-dark" : "bg-line-strong/40"}`} />
        ))}
      </span>
      {left} of {max} offers left
    </span>
  );
}

function Thumb({ src, alt, className }: { src?: string; alt: string; className: string }) {
  return src ? <ProductImage src={src} alt={alt} className={`${className} object-cover`} /> : <span className={`${className} block bg-surface-2`} aria-hidden />;
}

/** Per-unit bar for the first line: your offers, the seller's counters, list price and the agreed price. */
function PriceLadder({ n }: { n: Negotiation }) {
  const line = n.lines[0];
  const list = line.listUnitPriceCents;
  const points = n.rounds
    .filter((r) => r.lines.length > 0)
    .map((r) => ({ by: r.by, cents: r.lines.find((l) => l.productId === line.productId)?.unitPriceCents ?? list }));
  const agreed = n.agreedLines?.find((l) => l.productId === line.productId)?.unitPriceCents;
  const min = Math.min(...points.map((p) => p.cents), agreed ?? list) * 0.94;
  const pos = (c: number) => `${list > min ? ((c - min) / (list - min)) * 100 : 100}%`;
  const you = lastCustomerOffer(n, line.productId);
  const seller = lastSellerPrice(n, line.productId);

  return (
    <section className={`${TILE} p-6`} aria-labelledby="ladder-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ladder-h" className="font-semibold">
          Price per unit · {line.name}
        </h2>
        {!agreed && you > 0 && (
          <p className="tabular text-sm text-ink-2">
            Gap <span className="font-semibold text-ink">{formatMoney(seller - you)}</span> per unit
          </p>
        )}
      </div>
      <div className="relative mx-6 mb-12 mt-14 h-2 rounded-full bg-canvas">
        {!agreed && you > 0 && <div className="absolute inset-y-0 rounded-full bg-accent/50" style={{ left: pos(you), right: `calc(100% - ${pos(seller)})` }} />}
        {points.map((p, i) => (
          <span
            key={i}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${p.by === "customer" ? "size-3.5 rounded-full bg-ink" : "size-3.5 rotate-45 bg-accent ring-1 ring-ink/40"} ${i < points.length - 2 ? "opacity-40" : ""}`}
            style={{ left: pos(p.cents) }}
            aria-hidden
          />
        ))}
        {agreed && (
          <span className="absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-success text-white" style={{ left: pos(agreed) }}>
            <Check size={14} aria-hidden />
          </span>
        )}
        <span className="absolute -top-10 right-0 translate-x-1/2 text-center text-xs text-ink-3">
          List
          <span className="tabular block font-semibold text-ink">{formatMoney(list)}</span>
        </span>
        <span className="absolute right-0 top-1/2 h-5 w-0.5 -translate-y-1/2 bg-ink" aria-hidden />
        {you > 0 && !agreed && (
          <span className="absolute top-5 -translate-x-1/2 text-center text-xs text-ink-3" style={{ left: pos(you) }}>
            You
            <span className="tabular block font-semibold text-ink">{formatMoney(you)}</span>
          </span>
        )}
        {seller < list && !agreed && (
          <span className="absolute -top-10 -translate-x-1/2 text-center text-xs text-ink-3" style={{ left: pos(seller) }}>
            Seller
            <span className="tabular block font-semibold text-ink">{formatMoney(seller)}</span>
          </span>
        )}
        {agreed && (
          <span className="absolute top-5 -translate-x-1/2 text-center text-xs text-success" style={{ left: pos(agreed) }}>
            Agreed
            <span className="tabular block font-semibold">{formatMoney(agreed)}</span>
          </span>
        )}
      </div>
      <p className="sr-only">
        List price {formatMoney(list)} per unit.
        {you > 0 && !agreed && ` Your last offer ${formatMoney(you)}.`}
        {seller < list && !agreed && ` Seller's price ${formatMoney(seller)}.`}
        {agreed && ` Agreed ${formatMoney(agreed)}.`}
      </p>
    </section>
  );
}

const ACTION_LABEL = { offer: "offered", counter: "countered", accept: "accepted", reject: "declined" } as const;

function Timeline({ n }: { n: Negotiation }) {
  const qty = (id: string) => n.lines.find((l) => l.productId === id)?.quantity ?? 0;
  const time = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  return (
    <section aria-labelledby="history-h">
      <h2 id="history-h" className="display px-1 text-[24px]">
        History
      </h2>
      <ol className="mt-4">
        {n.rounds.map((r, i) => {
          const total = r.lines.reduce((s, l) => s + l.unitPriceCents * qty(l.productId), 0);
          const mine = r.by === "customer";
          return (
            <li key={r.n} className="relative flex gap-4 pb-6 last:pb-0">
              {i < n.rounds.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-line-strong" aria-hidden />}
              <span className={`relative grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${mine ? "bg-ink text-on-dark" : "bg-accent text-accent-ink"}`} aria-hidden>
                {mine ? "You" : "S"}
              </span>
              <div className="min-w-0 flex-1 rounded-[20px] bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {mine ? "You" : "SOCIMCO sales desk"} {ACTION_LABEL[r.action]}
                    <span className="ml-2 text-sm font-normal text-ink-3">Round {r.n}</span>
                  </p>
                  <p className="text-sm text-ink-3">
                    <time dateTime={r.createdAt}>{time(r.createdAt)}</time>
                  </p>
                </div>
                {r.lines.length > 0 && (
                  <p className="tabular mt-1 text-ink-2">
                    {r.lines.map((l) => `${formatMoney(l.unitPriceCents)} / unit`).join(" · ")}
                    <span className="ml-2 font-semibold text-ink">{formatMoney(total)} total</span>
                  </p>
                )}
                {r.message && <p className="mt-2 break-words border-l-2 border-line-strong pl-3 text-ink-2">“{r.message}”</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LinesSummary({ n, images }: { n: Negotiation; images: Images }) {
  const t = quoteTotals(n);
  const agreed = n.agreedTotalCents !== null;
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {n.lines.map((l) => (
          <li key={l.productId} className="flex gap-3">
            <Thumb src={images.get(l.productId)} alt="" className="size-12 shrink-0 rounded-[12px]" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold">{l.name}</p>
              <p className="tabular text-ink-3">
                {formatCount(l.quantity)} × {formatMoney(l.listUnitPriceCents)} list
              </p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="tabular space-y-1.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">List total</dt>
          <dd className={agreed ? "text-ink-3 line-through" : "font-semibold"}>{formatMoney(t.listTotalCents)}</dd>
        </div>
        {t.lastOfferTotalCents !== null && !agreed && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Your last offer</dt>
            <dd className="font-semibold">{formatMoney(t.lastOfferTotalCents)}</dd>
          </div>
        )}
        {t.lastCounterTotalCents !== null && !agreed && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Seller&apos;s price</dt>
            <dd className="font-semibold">{formatMoney(t.lastCounterTotalCents)}</dd>
          </div>
        )}
        {agreed && (
          <>
            <div className="flex items-baseline justify-between gap-3 text-base">
              <dt className="font-semibold">Agreed total</dt>
              <dd className="display text-[24px] leading-none">{formatMoney(n.agreedTotalCents ?? 0)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-success">
              <dt>You save</dt>
              <dd className="font-semibold">{formatMoney(n.savingsCents ?? 0)}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}

export function PriceFields({ form, label }: { form: OfferForm; label: string }) {
  // Unique per instance: the page can show the first-offer form and the counter form at once,
  // and duplicate ids would detach the label from its input (screen readers then read only the placeholder).
  const uid = useId();
  return (
    <div className="space-y-4">
      {form.lines.map((l) => (
        <div key={l.productId}>
          <label htmlFor={`${uid}-price-${l.productId}`} className="text-sm font-semibold">
            {label}
            {form.lines.length > 1 && <span className="font-normal text-ink-3"> · {l.name}</span>}
          </label>
          <div className={`mt-1.5 flex h-12 items-center rounded-[var(--radius-control)] border bg-surface ${l.error ? "border-danger" : "border-line-strong focus-within:border-ink"} focus-within:ring-2 focus-within:ring-focus`}>
            <span className="pl-3 text-ink-3" aria-hidden>
              $
            </span>
            <input
              id={`${uid}-price-${l.productId}`}
              inputMode="decimal"
              autoComplete="off"
              value={l.raw}
              onChange={(e) => form.set(l.productId, e.target.value)}
              placeholder={l.suggestions[0] ? (l.suggestions[0].cents / 100).toFixed(2) : "0.00"}
              aria-invalid={!!l.error}
              aria-describedby={`${uid}-hint-${l.productId}`}
              className="tabular h-full min-w-0 flex-1 bg-transparent px-1.5 text-lg font-semibold outline-none"
            />
            <span className="pr-3 text-sm text-ink-3">per unit</span>
          </div>
          <p id={`${uid}-hint-${l.productId}`} className={`mt-1.5 text-sm ${l.error ? "text-danger" : "text-ink-3"}`} aria-live="polite">
            {l.error ?? `${l.hint} · ${formatCount(l.quantity)} units`}
          </p>
          {l.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {l.suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => form.setCents(l.productId, s.cents)}
                  aria-pressed={l.cents === s.cents}
                  className="tabular min-h-11 rounded-full border border-line-strong px-4 text-sm font-medium hover:border-ink aria-pressed:border-dark aria-pressed:bg-dark aria-pressed:text-on-dark"
                >
                  {s.label} · {formatMoney(s.cents)}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {form.offerTotalCents !== null && (
        <p className="tabular flex justify-between gap-3 rounded-[14px] bg-surface-2 px-4 py-2.5 text-sm">
          Offer total <span className="font-semibold">{formatMoney(form.offerTotalCents)}</span>
        </p>
      )}
    </div>
  );
}

function StartQuote({ cart }: { cart: Cart }) {
  const { create } = useNegotiationActions();
  const run = useRun();
  const eligible = cart.items.filter((l) => l.negotiationEligible);
  const others = cart.items.filter((l) => !l.negotiationEligible);
  const form = useOfferForm({
    lines: eligible.map((l) => ({ productId: l.productId, name: l.name, quantity: l.quantity, listUnitPriceCents: l.unitPriceCents })),
    rounds: [],
  });

  if (eligible.length === 0) {
    return (
      <div className={`${TILE} p-8 text-center`}>
        <FileText className="mx-auto text-ink-3" size={28} aria-hidden />
        <p className="mt-3 font-semibold">No lines qualify for a trade price yet</p>
        <p className="mt-1 text-ink-2">Trade pricing starts at each product&apos;s minimum, usually 100 units.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`${BASE}/category/power-tools`} className={btn("primary", "md")}>
            Browse power tools
          </Link>
          {cart.items.length > 0 && (
            <Link href={`${BASE}/cart`} className={btn("outline", "md")}>
              Back to your cart
            </Link>
          )}
        </div>
      </div>
    );
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    form.touch();
    if (!form.allValid || create.isPending) return;
    const message = String(new FormData(e.currentTarget).get("message") ?? "").trim() || undefined;
    void run(create.mutateAsync({ lines: form.priced, message }), "Offer sent to the SOCIMCO sales desk", (n) => rememberQuote(n.id));
  };

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-4">
      <div className="space-y-3">
        <ul className="space-y-3">
          {eligible.map((l) => (
            <li key={l.productId} className={`${TILE} flex gap-4 p-2.5 pr-5`}>
              <Thumb src={l.imageUrl} alt="" className="size-20 shrink-0 rounded-[18px] sm:size-24" />
              <div className="min-w-0 flex-1 py-2">
                <p className="tabular text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">{l.sku}</p>
                <p className="font-semibold">{l.name}</p>
                <p className="tabular mt-1 text-ink-2">
                  {formatCount(l.quantity)} × {formatMoney(l.unitPriceCents)} = <span className="font-semibold text-ink">{formatMoney(l.lineTotalCents)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <p className="px-1 text-sm text-ink-3">
            {others.map((o) => `${formatCount(o.quantity)} × ${o.name}`).join(", ")} stay{others.length === 1 ? "s" : ""} at list price.
          </p>
        )}
        <div className="rounded-[var(--radius-card)] bg-dark p-6 text-on-dark">
          <p className="display text-[20px]">How trade quotes work</p>
          <ul className="mt-3 space-y-2 text-sm text-on-dark-2">
            <li>• You can make up to {maxOffers()} offers. Each must be above your previous one.</li>
            <li>• The sales desk accepts, declines or counters. Open quotes expire if nobody replies in time.</li>
            <li>• Your cart is locked while the quote is open. An agreed price holds for a limited time.</li>
          </ul>
        </div>
      </div>
      <div className={`${TILE} p-6 lg:sticky lg:top-[96px] lg:self-start`}>
        <h2 className="display text-[24px]">Your offer</h2>
        <div className="mt-4">
          <PriceFields form={form} label="Your price" />
        </div>
        <label className="mt-4 block text-sm font-semibold" htmlFor="message">
          Note to the sales desk <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={2}
          maxLength={500}
          placeholder="e.g. Fit-out for our three branches"
          className="mt-1.5 w-full rounded-[14px] border border-line-strong bg-surface p-3 outline-none focus:border-ink focus-visible:ring-2 focus-visible:ring-focus"
        />
        <button type="submit" disabled={create.isPending} aria-busy={create.isPending || undefined} className={btn("trade", "lg", "mt-4 w-full")}>
          {create.isPending ? (
            <>
              <Spinner /> Sending…
            </>
          ) : (
            <>
              Send offer <ArrowRight size={18} aria-hidden />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function ActionPanel({ n, images }: { n: Negotiation; images: Images }) {
  const actions = useNegotiationActions();
  const run = useRun();
  const form = useOfferForm(n);
  const remaining = useCountdown(n.expiresAt);
  const t = quoteTotals(n);
  const max = maxOffers(n);
  const busy = actions.offer.isPending || actions.accept.isPending || actions.reject.isPending || actions.cancel.isPending;
  const cancel = () => void run(actions.cancel.mutateAsync(n.id), "Quote cancelled");

  const sendCounter = (e: FormEvent) => {
    e.preventDefault();
    form.touch();
    if (!form.allValid || busy) return;
    void run(actions.offer.mutateAsync({ id: n.id, lines: form.priced }), "Counter offer sent", () => form.reset());
  };

  return (
    <div className={`${TILE} p-6`}>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Quote {quoteRef(n.id)}</Eyebrow>
        {!isQuoteClosed(n) && (
          <span className="tabular flex items-center gap-1.5 text-sm font-medium text-ink-2">
            <Clock size={15} aria-hidden />
            <span className="sr-only">Time left:</span> {formatCountdown(remaining)}
          </span>
        )}
      </div>
      <div className="mt-4">
        <LinesSummary n={n} images={images} />
      </div>

      <div className="mt-5 border-t border-canvas pt-5" aria-live="polite">
        {n.status === "awaiting_seller" && (
          <>
            <p className="font-semibold">Waiting for the sales desk</p>
            <p className="mt-1 text-sm text-ink-2">They&apos;ll accept, decline or counter your offer. You&apos;ll see it here.</p>
            <button type="button" onClick={cancel} disabled={busy} className={btn("danger", "md", "mt-4 w-full")}>
              Cancel quote
            </button>
          </>
        )}

        {n.status === "awaiting_customer" && (
          <>
            <p className="font-semibold">The sales desk countered. Your move.</p>
            <div className="mt-1">
              <OffersLeft left={n.customerRoundsLeft} max={max} />
            </div>
            <button type="button" onClick={() => void run(actions.accept.mutateAsync(n.id), "Price accepted")} disabled={busy} className={btn("primary", "lg", "mt-4 w-full")}>
              {actions.accept.isPending ? <Spinner /> : <Check size={18} aria-hidden />} Accept {formatMoney(t.lastCounterTotalCents ?? t.listTotalCents)}
            </button>
            {n.customerRoundsLeft > 0 ? (
              <form onSubmit={sendCounter} noValidate className="mt-5 border-t border-canvas pt-5">
                <PriceFields form={form} label="Or counter with" />
                <button type="submit" disabled={busy} aria-busy={actions.offer.isPending || undefined} className={btn("trade", "md", "mt-3 w-full")}>
                  {actions.offer.isPending && <Spinner />} Send counter offer
                </button>
              </form>
            ) : (
              <p className="mt-4 flex gap-2 rounded-[14px] bg-surface-2 p-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                You&apos;ve used all {max} offers. Accept or decline this price.
              </p>
            )}
            <button type="button" onClick={() => void run(actions.reject.mutateAsync(n.id), "Quote declined")} disabled={busy} className={btn("ghost", "md", "mt-2 w-full text-danger")}>
              Decline and pay list price
            </button>
          </>
        )}

        {n.status === "accepted" && (
          <>
            <p className="flex items-center gap-2 font-semibold text-success">
              <Check size={18} aria-hidden /> Price agreed
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Place your order within <span className="tabular font-semibold text-ink">{formatCountdown(remaining)}</span> to keep this price.
            </p>
            <Link href={`${BASE}/checkout`} className={btn("primary", "lg", "mt-4 w-full")}>
              Checkout · {formatMoney(n.agreedTotalCents ?? 0)} <ArrowRight size={17} aria-hidden />
            </Link>
            <button type="button" onClick={cancel} disabled={busy} className={btn("ghost", "md", "mt-2 w-full")}>
              Cancel quote
            </button>
          </>
        )}

        {n.status === "ordered" && (
          <>
            <p className="flex items-center gap-2 font-semibold text-success">
              <Check size={18} aria-hidden /> Ordered at the agreed price
            </p>
            <p className="mt-1 text-sm text-ink-2">This quote became an order. You can start a new quote any time.</p>
            <Link href={`${BASE}/orders`} className={btn("outline", "md", "mt-4 w-full")}>
              View your orders
            </Link>
          </>
        )}

        {(n.status === "rejected" || n.status === "expired" || n.status === "cancelled") && (
          <>
            <p className="font-semibold">
              {n.status === "rejected" ? "This quote was declined." : n.status === "expired" ? "This quote expired." : "This quote was cancelled."}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
              <Lock size={14} aria-hidden /> Your cart is unlocked. Order at list price or start a new quote.
            </p>
            <Link href={`${BASE}/cart`} className={btn("outline", "md", "mt-4 w-full")}>
              Back to your cart
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

const LEAD: Partial<Record<Negotiation["status"], string>> = {
  awaiting_customer: "The sales desk has countered. Accept their price, make another offer, or decline.",
  awaiting_seller: "Your offer is with the SOCIMCO sales desk. This page updates when they reply.",
  accepted: "Both sides agreed. The agreed price applies when you place the order.",
  ordered: "This quote is closed: it became an order.",
  rejected: "The sales desk declined this quote. Order at list price or start a new quote below.",
  cancelled: "This quote was cancelled. Order at list price or start a new quote below.",
  expired: "This quote expired before both sides agreed. Start a new quote below.",
};

/** The trade quote: start one from the cart, follow the rounds, and act on the sales desk's reply. */
export function NegotiationScreen() {
  const params = useSearchParams();
  const cart = useCart();
  const remembered = useRememberedQuote();
  const id = cart.data?.lockedByNegotiationId ?? params.get("id") ?? remembered;
  const quote = useNegotiation(cart.data ? id : null);
  // A remembered quote that's gone (or belongs to another account) is simply forgotten.
  const missing = isApiError(quote.error) && (quote.error.code === "NOT_FOUND" || quote.error.code === "FORBIDDEN");
  const n = missing ? undefined : quote.data;
  const images: Images = new Map((cart.data?.items ?? []).map((i) => [i.productId, i.imageUrl]));
  const loading = cart.isPending || (!!id && quote.isPending && !missing);
  const failed = cart.error ?? (missing ? null : quote.error);
  const showStart = !n || isQuoteClosed(n);

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-16 lg:px-6 lg:pb-6">
      <nav aria-label="Breadcrumb" className="px-1 pt-4 text-sm text-ink-3">
        <ol className="flex flex-wrap items-center gap-x-1">
          <li>
            <Link href={BASE || "/"} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
              Home
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRight size={14} aria-hidden />
            <Link href={`${BASE}/cart`} className="inline-flex min-h-11 items-center hover:text-ink hover:underline">
              Cart
            </Link>
          </li>
          <li className="flex items-center gap-1">
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page" className="inline-flex min-h-11 items-center text-ink">
              Trade quote
            </span>
          </li>
        </ol>
      </nav>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-1">
        <h1 className="display text-[34px] leading-[1.05] sm:text-[46px]">{n ? "Trade quote" : "Request a trade price"}</h1>
        {n && <Stamp status={n.status} />}
        {n && !isQuoteClosed(n) && n.status !== "accepted" && <OffersLeft left={n.customerRoundsLeft} max={maxOffers(n)} />}
      </header>
      <p className="mt-2 max-w-2xl px-1 text-[15px] text-ink-3">
        {(n && LEAD[n.status]) ?? "Propose a per-unit price for qualifying lines. The sales desk will accept, decline or counter."}
      </p>

      {loading ? (
        <div className={`${TILE} mt-6 flex items-center justify-center gap-3 p-12 text-ink-3`} aria-busy="true">
          <Spinner /> Loading your quote…
        </div>
      ) : failed ? (
        <ErrorTile
          className="mt-6"
          message={errorMessage(failed)}
          onRetry={() => {
            void cart.refetch();
            if (id) void quote.refetch();
          }}
        />
      ) : (
        <>
          {n && isQuoteClosed(n) && (
            <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-4">
              <div className="order-2 lg:order-1">
                <Timeline n={n} />
              </div>
              <div className="order-1 lg:order-2">
                <ActionPanel n={n} images={images} />
              </div>
            </div>
          )}

          <div className={n ? "mt-8" : "mt-6"}>
            {showStart ? (
              <>
                {n && <h2 className="display mb-4 px-1 text-[26px]">Start a new quote</h2>}
                {cart.data && <StartQuote key={n?.id ?? "new"} cart={cart.data} />}
              </>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-4">
                <div className="order-2 min-w-0 space-y-6 lg:order-1">
                  <PriceLadder n={n} />
                  <Timeline n={n} />
                </div>
                <div className="order-1 lg:sticky lg:top-[96px] lg:order-2 lg:self-start">
                  <ActionPanel key={`${n.id}-${n.rounds.length}`} n={n} images={images} />
                </div>
              </div>
            )}
          </div>
          {n?.status === "rejected" && (
            <p className="mt-6 flex items-center gap-2 px-1 text-sm text-ink-3">
              <X size={14} aria-hidden /> The seller declined. Their decision ends this quote.
            </p>
          )}
        </>
      )}
    </div>
  );
}
