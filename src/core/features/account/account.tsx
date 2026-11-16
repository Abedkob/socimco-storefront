"use client";

import { ArrowRight, Building2, Headset, KeyRound, LogOut, Mail, MapPin, Pencil, Plus, QrCode, Smartphone, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { qrLoginEnabled } from "@/core/api/client/config";
import { useLogout, useMe, useOrders } from "@/core/api/client/react";
import { BASE, btn, formatCount, formatMoney, PageHeader, ProposalTag, proposalMessage, Sheet, Spinner, TILE, useToast } from "@/core/ui";
import { PhoneCodePanel } from "./phone-code";

/** The customer's sales contact. Not in the API yet, so it's the shop's general desk. */
const SALES_DESK = { name: "SOCIMCO Sales Desk", email: "sales@socimco.example", hours: "Mon–Fri, 7 am–5 pm · replies to quotes within the hour" };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function AccountScreen() {
  const router = useRouter();
  const { notify } = useToast();
  const me = useMe();
  const orders = useOrders();
  const logout = useLogout();
  const [phoneCode, setPhoneCode] = useState(false);
  // The shop layout's AuthGate only renders this once the customer is known.
  const user = me.data?.user;
  if (!user) return null;

  const list = orders.data?.items ?? [];
  const saved = list.reduce((t, o) => t + o.savingsCents, 0);
  const ordersLoading = orders.isPending;
  const proposal = (what: string) => notify(proposalMessage(what), "info");
  const signOut = () => logout.mutate(undefined, { onSettled: () => router.replace("/login") });

  return (
    <div className="mx-auto max-w-[1400px] px-3 pb-16 lg:px-6 lg:pb-6">
      <PageHeader crumbs={[{ label: "Home", href: BASE || "/" }, { label: "Account" }]} title="Account" lead={`${user.company} · trade customer`} />

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
        {/* Profile */}
        <section className="relative overflow-hidden rounded-[28px] bg-dark p-6 text-on-dark lg:col-span-5 lg:p-8" aria-labelledby="profile-h">
          <div className="absolute -right-20 -top-24 size-[300px] rounded-full bg-[radial-gradient(circle,rgb(53_179_53/0.28),transparent_65%)]" aria-hidden />
          <div className="relative flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-accent text-[20px] font-bold text-accent-ink" aria-hidden>
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0">
              <h2 id="profile-h" className="display text-[26px] leading-tight">
                {user.name}
              </h2>
              <p className="text-on-dark-2">{user.company}</p>
            </div>
          </div>
          <dl className="relative mt-6 space-y-3 text-[15px]">
            {(
              [
                [Mail, "Email", user.email],
                [UserRound, "Role", "Trade customer · buyer"],
                [Building2, "Company", user.company],
              ] as const
            ).map(([I, k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <I size={17} className="shrink-0 text-on-dark-2" aria-hidden />
                <dt className="sr-only">{k}</dt>
                <dd className="min-w-0 truncate">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="relative mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] bg-white/15">
            <div className="bg-dark-2/80 p-4">
              <p className="text-[12px] text-on-dark-2">Orders</p>
              <p className="tabular display text-[24px]">{ordersLoading ? "—" : formatCount(list.length)}</p>
            </div>
            <div className="bg-dark-2/80 p-4">
              <p className="text-[12px] text-on-dark-2">Saved with quotes</p>
              <p className="tabular display truncate text-[24px] text-[#9fd8b7]">{ordersLoading ? "—" : formatMoney(saved)}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 lg:col-span-7 lg:gap-4">
          {/* Addresses */}
          <section className={`${TILE} p-6`} aria-labelledby="addr-h">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="addr-h" className="display text-[22px]">
                Delivery addresses
              </h2>
              <button type="button" onClick={() => proposal("Adding addresses")} className={btn("ghost", "sm")}>
                <Plus size={16} aria-hidden /> Add <ProposalTag />
              </button>
            </div>
            {user.addresses.length === 0 ? (
              <p className="mt-4 rounded-[20px] bg-surface-2 p-4 text-[15px] text-ink-2">No delivery addresses yet. Ask your sales desk to add one.</p>
            ) : (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {user.addresses.map((a) => (
                  <li key={a.id} className="flex gap-3 rounded-[20px] bg-surface-2 p-4">
                    <MapPin size={18} className="mt-0.5 shrink-0 text-success" aria-hidden />
                    <div className="min-w-0 flex-1 text-[15px] leading-relaxed">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {a.label}
                        {a.isDefault && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-3 ring-1 ring-line">Default</span>}
                      </p>
                      <p className="text-ink-2">
                        {a.line1}, {a.city} {a.postalCode}, {a.country}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => proposal("Editing addresses")}
                      className="-m-1.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-surface hover:text-ink"
                      aria-label={`Edit ${a.label} (Proposal)`}
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-2 lg:gap-4">
            {/* Sales desk */}
            <section className={`${TILE} p-6`} aria-labelledby="desk-h">
              <h2 id="desk-h" className="display flex items-center gap-2 text-[20px]">
                <Headset size={19} className="text-success" aria-hidden /> Your sales desk
              </h2>
              <p className="mt-2 font-semibold">{SALES_DESK.name}</p>
              <a href={`mailto:${SALES_DESK.email}`} className="inline-flex min-h-11 items-center text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                {SALES_DESK.email}
              </a>
              <p className="text-sm text-ink-3">{SALES_DESK.hours}</p>
            </section>

            {/* Sign-in */}
            <section className={`${TILE} p-6`} aria-labelledby="sec-h">
              <h2 id="sec-h" className="display flex items-center gap-2 text-[20px]">
                <KeyRound size={19} className="text-success" aria-hidden /> Sign-in
              </h2>
              <p className="mt-2 text-sm text-ink-2">
                Sessions last 12 hours.
                {qrLoginEnabled() && (
                  <>
                    <span className="hidden lg:inline"> Show a code here to sign your phone in without a password.</span>
                    <span className="lg:hidden"> To sign in a computer, scan the code on its sign-in page with this phone.</span>
                  </>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {qrLoginEnabled() && (
                  <>
                    {/* Computers: show a code for a phone to sign in with. Phones: scan a computer's code. */}
                    <button type="button" onClick={() => setPhoneCode(true)} className={btn("primary", "sm", "hidden lg:inline-flex")}>
                      <QrCode size={15} aria-hidden /> Sign in on your phone
                    </button>
                    <Link href="/qr/approve" className={btn("outline", "sm", "lg:hidden")}>
                      <Smartphone size={15} aria-hidden /> Approve a computer
                    </Link>
                  </>
                )}
                <button type="button" onClick={signOut} disabled={logout.isPending} aria-busy={logout.isPending || undefined} className={btn("ghost", "sm")}>
                  {logout.isPending ? <Spinner /> : <LogOut size={15} aria-hidden />} {logout.isPending ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </section>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:gap-4">
            <Link href={`${BASE}/orders`} className="group flex items-center justify-between gap-3 rounded-[var(--radius-card)] bg-surface p-6 hover:bg-surface-2">
              <span className="min-w-0">
                <span className="display block text-[20px]">Orders</span>
                <span className="block truncate text-sm text-ink-3">
                  {ordersLoading ? "Loading…" : list.length === 0 ? "No orders yet" : `${formatCount(list.length)} ${list.length === 1 ? "order" : "orders"} · latest ${list[0].number}`}
                </span>
              </span>
              <span className="btn-raised grid size-11 shrink-0 place-items-center rounded-full bg-dark text-on-dark transition-transform group-hover:translate-x-0.5" aria-hidden>
                <ArrowRight size={18} />
              </span>
            </Link>
          </div>
        </div>
      </div>

      <Sheet open={phoneCode} onClose={() => setPhoneCode(false)} side="right" label="Sign in on your phone">
        <PhoneCodePanel onClose={() => setPhoneCode(false)} />
      </Sheet>
    </div>
  );
}
