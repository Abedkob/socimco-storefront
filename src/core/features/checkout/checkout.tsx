"use client";

import { AlertTriangle, ArrowRight, Clock, FileText, MapPin, PackageCheck, Plus, ShoppingBag, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart, useMe, useNegotiation, useNegotiationActions, usePlaceOrder } from "@/core/api/client/react";
import { computeTotals, isApiError, type ErrorCode, type Order } from "@/core/contract";
import { flagShortLines, shortLinesFromError } from "@/core/features/cart";
import { isQuoteOpen } from "@/core/features/negotiation";
import {
  BASE,
  btn,
  ErrorTile,
  errorMessage,
  Eyebrow,
  formatCount,
  formatCountdown,
  formatMoney,
  NegotiatedChip,
  PageHeader,
  ProductImage,
  proposalMessage,
  ProposalTag,
  Spinner,
  TILE,
  unitLabel,
  useCountdown,
  useToast,
} from "@/core/ui";

/** Errors that stop checkout altogether, until the buyer fixes the cart or the quote. */
type BlockCode = Extract<ErrorCode, "CART_EMPTY" | "NEGOTIATION_NOT_ACCEPTED" | "NEGOTIATION_EXPIRED">;
const BLOCKING: readonly ErrorCode[] = ["CART_EMPTY", "NEGOTIATION_NOT_ACCEPTED", "NEGOTIATION_EXPIRED"];

const BLOCK_COPY: Record<BlockCode, { title: string; body: string }> = {
  CART_EMPTY: { title: "Rien à commander", body: "Votre panier est vide. Ajoutez les articles dont vous avez besoin, puis revenez ici." },
  NEGOTIATION_NOT_ACCEPTED: {
    title: "Finalisez d'abord votre devis",
    body: "Votre devis est toujours en cours auprès du service commercial. Convenez d'un prix, ou annulez le devis et payez le prix catalogue.",
  },
  NEGOTIATION_EXPIRED: {
    title: "Votre prix convenu a expiré",
    body: "Le prix convenu n'est plus garanti. Demandez un nouveau devis ou commandez au prix catalogue.",
  },
};

function SectionTitle({ id, n, children }: { id: string; n: number; children: string }) {
  return (
    <h2 id={id} className="display flex items-center gap-2.5 text-[22px]">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-dark text-[13px] font-bold text-on-dark" aria-hidden>
        {n}
      </span>
      {children}
    </h2>
  );
}

function OrderPlaced({ order, name, email }: { order: Order; name?: string; email?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const items = order.lines.reduce((t, l) => t + l.quantity, 0);
  const SAVED = "Économies";
  const stats: [string, string][] = [
    ["Total", formatMoney(order.totalCents)],
    [SAVED, order.discountCents > 0 ? formatMoney(order.discountCents) : "—"],
    ["Articles", formatCount(items)],
    ["Livraison à", order.shippingAddress.label],
  ];
  return (
    <div className="mx-auto max-w-[1100px] px-3 pb-16 pt-6 lg:px-6" aria-live="polite">
      <div className="overflow-hidden rounded-[32px] bg-dark text-on-dark">
        <div className="relative p-6 sm:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 size-[360px] rounded-full bg-[radial-gradient(circle,rgb(53_179_53/0.3),transparent_65%)]" aria-hidden />
          <span className="relative grid size-16 place-items-center rounded-full bg-success text-white">
            <PackageCheck size={30} aria-hidden />
          </span>
          {name && <p className="relative mt-6 text-on-dark-2">Merci, {name.split(" ")[0]}</p>}
          <h1 ref={heading} tabIndex={-1} className="display relative mt-1 break-words text-[36px] leading-[1.02] outline-none sm:text-[56px]">
            Commande <span className="tabular bg-[linear-gradient(100deg,#c9f2c9,#35b335)] bg-clip-text text-transparent">{order.number}</span> validée
          </h1>
          <p className="relative mt-3 max-w-xl text-on-dark-2">
            {email ? `Nous avons envoyé la confirmation à ${email}.` : "Nous vous avons envoyé une confirmation."} Votre commande quittera l&apos;entrepôt
            le jour ouvré suivant.
          </p>
          <dl className="tabular relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-white/15 sm:grid-cols-4">
            {stats.map(([k, v]) => (
              <div key={k} className="min-w-0 bg-dark-2/80 px-4 py-4">
                <dt className="text-[12px] text-on-dark-2">{k}</dt>
                <dd className={`mt-0.5 truncate text-[20px] font-semibold ${k === SAVED && order.discountCents > 0 ? "text-[#9fd8b7]" : ""}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="relative mt-8 flex flex-wrap gap-2">
            <Link href={`${BASE}/orders/${order.id}`} className={btn("light", "lg")}>
              Voir la commande <ArrowRight size={17} aria-hidden />
            </Link>
            <Link href={BASE || "/"} className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-on-dark ring-1 ring-inset ring-white/25 hover:bg-white/10">
              Retour à la boutique
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Checkout: address, delivery, lines at their agreed or list price, and placing the order (one click = one order). */
export function CheckoutScreen() {
  const me = useMe();
  const cart = useCart();
  const quote = useNegotiation(cart.data?.lockedByNegotiationId ?? null);
  const { cancel } = useNegotiationActions();
  const place = usePlaceOrder();
  const { notify } = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [serverBlock, setServerBlock] = useState<BlockCode | null>(null);
  const [error, setError] = useState<{ code: ErrorCode | null; message: string } | null>(null);

  const n = quote.data;
  const remaining = useCountdown(n?.status === "accepted" ? n.expiresAt : null);
  const user = me.data?.user;
  const addresses = user?.addresses ?? [];
  const addressId = picked ?? addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "";
  const address = addresses.find((a) => a.id === addressId);

  if (placed) return <OrderPlaced order={placed} name={user?.name} email={user?.email} />;

  const loading = cart.isPending || (!!cart.data?.lockedByNegotiationId && quote.isPending);
  const failed = cart.error ?? quote.error;
  const items = cart.data?.items ?? [];
  const accepted = n?.status === "accepted";
  const negotiated = accepted && (n.agreedLines?.length ?? 0) > 0;

  const derivedBlock: BlockCode | null =
    items.length === 0 ? "CART_EMPTY" : isQuoteOpen(n) ? "NEGOTIATION_NOT_ACCEPTED" : accepted && remaining <= 0 ? "NEGOTIATION_EXPIRED" : null;
  const blocked = serverBlock ?? derivedBlock;

  const lines = items.map((item) => {
    const agreed = negotiated ? n.agreedLines?.find((l) => l.productId === item.productId) : undefined;
    const listUnitPriceCents = agreed ? (n?.lines.find((l) => l.productId === item.productId)?.listUnitPriceCents ?? item.unitPriceCents) : item.unitPriceCents;
    const unitPriceCents = agreed?.unitPriceCents ?? item.unitPriceCents;
    return { ...item, listUnitPriceCents, unitPriceCents, negotiated: !!agreed, lineTotalCents: unitPriceCents * item.quantity };
  });
  const totals = computeTotals(lines);

  const submit = () => {
    if (place.isPending || !addressId) return;
    setError(null);
    place.mutate(
      { shippingAddressId: addressId, negotiationId: accepted ? n.id : null },
      {
        onSuccess: (data) => setPlaced(data.order),
        onError: (e) => {
          const code = isApiError(e) ? e.code : null;
          if (code && BLOCKING.includes(code)) {
            setServerBlock(code as BlockCode);
            void cart.refetch();
            if (n) void quote.refetch();
            return;
          }
          const short = shortLinesFromError(e);
          if (short) flagShortLines(short);
          if (code === "ADDRESS_NOT_FOUND") {
            setPicked(null);
            void me.refetch();
          }
          setError({ code, message: errorMessage(e) });
        },
      },
    );
  };

  /** Drop the quote (if it's still live) and carry on at list price. */
  const payListPrice = () => {
    const done = () => {
      setServerBlock(null);
      notify("Devis annulé. Vous commandez désormais au prix catalogue.", "info");
    };
    if (n && (isQuoteOpen(n) || n.status === "accepted")) {
      cancel.mutate(n.id, { onSuccess: done, onError: (e) => notify(errorMessage(e), "danger") });
    } else {
      setServerBlock(null);
      void cart.refetch();
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-16 lg:px-6 lg:pb-6">
      <PageHeader
        crumbs={[{ label: "Accueil", href: BASE || "/" }, { label: "Panier", href: `${BASE}/cart` }, { label: "Commande" }]}
        title="Commande"
        lead={negotiated && !blocked ? "Votre prix négocié convenu est appliqué ci-dessous." : "Vérifiez la livraison et votre commande, puis validez-la."}
      />

      {loading ? (
        <div className={`${TILE} mt-6 flex items-center justify-center gap-3 p-12 text-ink-3`} aria-busy="true">
          <Spinner /> Chargement de votre commande…
        </div>
      ) : failed ? (
        <ErrorTile
          className="mt-6"
          message={errorMessage(failed)}
          onRetry={() => {
            void cart.refetch();
            if (n) void quote.refetch();
          }}
        />
      ) : blocked ? (
        <div className={`${TILE} mt-6 flex flex-col items-start gap-4 p-6 sm:p-8 md:flex-row md:items-center`} role="status">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent-soft text-success">
            {blocked === "CART_EMPTY" ? <ShoppingBag size={24} aria-hidden /> : blocked === "NEGOTIATION_EXPIRED" ? <Clock size={24} aria-hidden /> : <FileText size={24} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-[26px] leading-tight">{BLOCK_COPY[blocked].title}</h2>
            <p className="mt-1 text-ink-2">{BLOCK_COPY[blocked].body}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {blocked === "CART_EMPTY" ? (
              <>
                <Link href={`${BASE}/category/power-tools`} className={btn("primary", "lg")}>
                  Voir l&apos;outillage électroportatif
                </Link>
                <Link href={`${BASE}/orders`} className={btn("outline", "lg")}>
                  Vos commandes
                </Link>
              </>
            ) : (
              <>
                <Link href={`${BASE}/negotiation`} className={btn("trade", "lg")}>
                  {blocked === "NEGOTIATION_EXPIRED" ? "Demander un nouveau devis" : "Voir votre devis"}
                </Link>
                <button type="button" onClick={payListPrice} disabled={cancel.isPending} className={btn("outline", "lg")}>
                  {cancel.isPending && <Spinner />} Payer le prix catalogue
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-4">
          <div className="min-w-0 space-y-3">
            <section className={`${TILE} p-6`} aria-labelledby="addr-h">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle id="addr-h" n={1}>
                  Adresse de livraison
                </SectionTitle>
                <button
                  type="button"
                  onClick={() =>
                    notify(`${proposalMessage("L'ajout d'une adresse depuis la boutique")} Demandez au service commercial d'en ajouter une à votre compte.`, "info")
                  }
                  className={btn("ghost", "sm")}
                >
                  <Plus size={16} aria-hidden /> Ajouter une adresse <ProposalTag />
                </button>
              </div>
              {addresses.length === 0 ? (
                <p className="mt-4 rounded-[20px] bg-surface-2 p-4 text-sm text-ink-2">
                  Aucune adresse de livraison n&apos;est encore enregistrée sur votre compte. Demandez au service commercial SOCIMCO d&apos;en ajouter une, puis
                  revenez valider la commande.
                </p>
              ) : (
                <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
                  <legend className="sr-only">Choisissez une adresse de livraison</legend>
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      className={`flex cursor-pointer gap-3 rounded-[20px] p-4 ring-inset transition-colors focus-within:ring-2 focus-within:ring-focus ${addressId === a.id ? "bg-surface-2 ring-2 ring-dark" : "ring-1 ring-line hover:ring-line-strong"}`}
                    >
                      <input type="radio" name="address" value={a.id} checked={addressId === a.id} onChange={() => setPicked(a.id)} className="mt-1 size-5 shrink-0 accent-[#06163d]" />
                      <span className="min-w-0 text-[15px] leading-relaxed">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          <MapPin size={15} aria-hidden /> {a.label}
                          {a.isDefault && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-3 ring-1 ring-line">Par défaut</span>}
                        </span>
                        <span className="block break-words text-ink-2">
                          {a.line1}, {a.postalCode} {a.city}, {a.country}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </section>

            <section className={`${TILE} p-6`} aria-labelledby="ship-h">
              <SectionTitle id="ship-h" n={2}>
                Livraison
              </SectionTitle>
              <div className="mt-4 flex items-center gap-4 rounded-[20px] bg-surface-2 p-4">
                <Truck size={22} className="shrink-0 text-success" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold">Livraison professionnelle standard</p>
                  <p className="text-sm text-ink-2">Expédition le jour ouvré suivant{address ? ` · 1 à 2 jours jusqu'à ${address.city}` : ""}</p>
                </div>
              </div>
            </section>

            <section className={`${TILE} p-6`} aria-labelledby="items-h">
              <SectionTitle id="items-h" n={3}>
                Articles
              </SectionTitle>
              <ul className="mt-4 divide-y divide-canvas">
                {lines.map((l) => (
                  <li key={l.productId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <ProductImage src={l.imageUrl} alt="" className="size-16 shrink-0 rounded-[14px] object-cover sm:size-20" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{l.name}</p>
                        {l.negotiated && <NegotiatedChip />}
                      </div>
                      <p className="tabular mt-0.5 text-sm text-ink-3">
                        {formatCount(l.quantity)} ×{" "}
                        {l.negotiated && (
                          <>
                            <span className="sr-only">prix catalogue </span>
                            <s className="mr-1">{formatMoney(l.listUnitPriceCents)}</s>
                            <span className="sr-only">, vous payez </span>
                          </>
                        )}
                        <span className={l.negotiated ? "font-semibold text-ink" : ""}>{formatMoney(l.unitPriceCents)}</span> / {unitLabel(l.unit, 1)}
                      </p>
                      {l.negotiated && (
                        <p className="tabular text-sm font-semibold text-success">Économie de {formatMoney((l.listUnitPriceCents - l.unitPriceCents) * l.quantity)}</p>
                      )}
                    </div>
                    <p className="tabular shrink-0 font-semibold">{formatMoney(l.lineTotalCents)}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="lg:sticky lg:top-[96px] lg:self-start" aria-label="Récapitulatif de la commande">
            <div className={`${TILE} p-6`}>
              <Eyebrow>Récapitulatif</Eyebrow>
              {negotiated && (
                <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-accent-soft p-3.5 text-sm">
                  <Clock size={17} className="shrink-0 text-success" aria-hidden />
                  <p>
                    Prix convenu garanti encore <span className="tabular font-semibold">{formatCountdown(remaining)}</span>
                  </p>
                </div>
              )}
              <dl className="tabular mt-4 space-y-2 text-[15px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Sous-total au prix catalogue</dt>
                  <dd className={negotiated ? "text-ink-3 line-through" : "font-semibold"}>{formatMoney(totals.subtotalCents)}</dd>
                </div>
                {totals.discountCents > 0 && (
                  <div className="flex justify-between gap-3 text-success">
                    <dt>Économies négociées</dt>
                    <dd className="font-semibold">−{formatMoney(totals.discountCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Livraison</dt>
                  <dd>{totals.shippingCents === 0 ? "Offerte" : formatMoney(totals.shippingCents)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Taxes</dt>
                  <dd>{formatMoney(totals.taxCents)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-canvas pt-4">
                <span className="font-semibold">Total</span>
                <span className="tabular display text-[36px] leading-none">{formatMoney(totals.totalCents)}</span>
              </div>

              <div aria-live="assertive">
                {error && (
                  <div className="mt-4 flex gap-3 rounded-[18px] bg-danger-soft p-4 text-sm text-danger" role="alert">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <p className="font-semibold">Nous n&apos;avons pas pu valider votre commande</p>
                      <p className="mt-0.5">{error.message}</p>
                      {error.code === "OUT_OF_STOCK" ? (
                        <Link href={`${BASE}/cart`} className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                          Vérifier votre panier
                        </Link>
                      ) : error.code === "ADDRESS_NOT_FOUND" ? (
                        <p className="mt-2">Choisissez une autre adresse de livraison ci-dessus, puis réessayez.</p>
                      ) : (
                        <button type="button" onClick={submit} className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                          Réessayer
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={submit}
                disabled={place.isPending || !addressId}
                aria-busy={place.isPending || undefined}
                className={btn("primary", "lg", "mt-5 w-full")}
              >
                {place.isPending ? (
                  <>
                    <Spinner /> Validation en cours…
                  </>
                ) : (
                  <>Valider la commande · {formatMoney(totals.totalCents)}</>
                )}
              </button>
              <p className="mt-3 text-center text-[13px] text-ink-3">
                {accepted ? "La validation de la commande clôture votre devis." : "Vous recevrez immédiatement une confirmation par e-mail."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
