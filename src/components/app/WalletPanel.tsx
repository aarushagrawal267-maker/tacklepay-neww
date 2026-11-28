"use client";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { Avatar, ContactAvatar } from "@/components/ui/Avatar";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Perforation } from "@/components/ui/Perforation";
import { QrCode } from "@/components/ui/QrCode";
import { totalBalance } from "@/lib/actions";
import { formatDay, formatTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import type { Contact, Transaction } from "@/lib/types";

const noop = () => () => {};

const ACTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/explore", label: "Pay", icon: "send" },
  { href: "/my-code?tab=qr", label: "Receive", icon: "qr_code_2" },
  { href: "/add-money", label: "Add money", icon: "add_circle" },
];

/**
 * Right-hand column on wide laptop screens: the balance, quick actions and recent activity that a
 * phone shows across several screens, plus a QR code to open TacketPay on a phone.
 */
export function WalletPanel() {
  const hydrated = useHydrated();
  const signedIn = useStore((s) => s.onboarded) && hydrated;
  const balance = useStore(totalBalance);
  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const contacts = useStore((s) => s.contacts);
  const handle = useStore((s) => s.profile.handle);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const recent = useMemo(() => [...transactions].sort((a, b) => b.at - a.at).slice(0, 6), [transactions]);
  const byId = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  return (
    <aside aria-label="Wallet" className="wallet-panel h-dvh w-[21rem] shrink-0 flex-col gap-4 overflow-y-auto px-5 py-6">
      {signedIn ? (
        <>
          <section className="stub rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm text-text-2">Total balance</h2>
              <DemoBadge compact />
            </div>
            <p className="money mt-2 text-[2rem] font-medium leading-tight">{formatMoney(balance)}</p>
            <p className="mt-1 truncate text-xs text-text-3">{handle}</p>
            <Perforation className="-mx-5 mt-4" />
            <ul className="mt-3 space-y-2">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-text-2">
                    {a.bank} {a.last4}
                    {a.primary && <span className="ml-1.5 text-xs text-success">Primary</span>}
                  </span>
                  <span className="money shrink-0">{formatMoney(a.balance)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {ACTIONS.map((a) => (
                <Link key={a.href} href={a.href} className="press flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 py-3 text-xs font-medium dark:bg-surface-3">
                  <Icon name={a.icon} size={20} className="text-text-2" />
                  {a.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-line">
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <h2 className="text-[0.9375rem] font-medium">Recent activity</h2>
              <Link href="/transactions" className="text-[0.8125rem] font-medium text-primary-fg">
                See all
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="px-5 pb-5 pt-2 text-sm text-text-2">Payments you make or receive show up here.</p>
            ) : (
              <ul className="pb-2">
                {recent.map((t) => (
                  <ActivityRow key={t.id} tx={t} contact={t.contactId ? byId.get(t.contactId) : undefined} />
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <section className="space-y-3 rounded-2xl border border-line p-5 text-sm leading-relaxed text-text-2">
          <DemoBadge />
          <p>
            Every rupee in TacketPay is play money moving over TPI, a UPI-style demo network. No bank is connected, no UPI request is ever sent, and receipts are
            watermarked as demo.
          </p>
        </section>
      )}

      <section className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4 dark:bg-surface-3">
        <div className="shrink-0">
          {origin ? <QrCode value={origin} size={76} label="QR code to open TacketPay on a phone" /> : <div className="size-[6.25rem] rounded-2xl bg-white" />}
        </div>
        <p className="text-xs leading-relaxed text-text-2">
          <span className="block text-sm font-medium text-text">Open on a phone</span>
          Scan to use TacketPay on your phone too. It needs to reach this computer, so use the Network address the dev server prints.
        </p>
      </section>
    </aside>
  );
}

function ActivityRow({ tx, contact }: { tx: Transaction; contact?: Contact }) {
  const credit = tx.direction === "credit";
  const day = formatDay(tx.at);
  return (
    <li>
      <Link href={`/receipt/${tx.id}`} className="press flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
        {contact ? <ContactAvatar contact={contact} size={34} /> : <Avatar name={tx.counterpartyName} size={34} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{tx.counterpartyName}</span>
          <span className="block text-xs text-text-3">{day === "Today" ? formatTime(tx.at) : day}</span>
        </span>
        <span className={`money shrink-0 text-sm ${tx.status === "reversed" ? "text-text-3 line-through" : credit ? "text-success" : "text-text"}`}>
          {formatMoney(credit ? tx.amount : -tx.amount, { sign: true }).replace(" ", "")}
        </span>
      </Link>
    </li>
  );
}
