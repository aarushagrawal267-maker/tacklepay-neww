"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, ContactAvatar } from "@/components/ui/Avatar";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Screen, ScreenSkeleton, ScrollBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { formatDay } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import type { Contact, Transaction, TxMethod } from "@/lib/types";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "debit", label: "Paid" },
  { id: "credit", label: "Received" },
] as const;

const SYSTEM_ICONS: Partial<Record<TxMethod, { icon: IconName; color: string }>> = {
  reward: { icon: "trophy", color: "#F29900" },
  welcome: { icon: "science", color: "#6b4a00" },
  self: { icon: "sync_alt", color: "#2962ff" },
  topup: { icon: "add_circle", color: "#15803d" },
  bill: { icon: "receipt_long", color: "#185ABC" },
  recharge: { icon: "mobile", color: "#1E8E3E" },
};

const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });

export function Transactions() {
  const hydrated = useHydrated();
  const transactions = useStore((s) => s.transactions);
  const contacts = useStore((s) => s.contacts);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const groups = useMemo(() => {
    const list = transactions.filter((t) => filter === "all" || t.direction === filter).sort((a, b) => b.at - a.at);
    const out: { month: string; items: Transaction[] }[] = [];
    for (const t of list) {
      const month = monthFmt.format(new Date(t.at));
      if (out.at(-1)?.month !== month) out.push({ month, items: [] });
      out.at(-1)!.items.push(t);
    }
    return out;
  }, [transactions, filter]);

  if (!hydrated) return <ScreenSkeleton />;
  const byId = new Map(contacts.map((c) => [c.id, c]));

  return (
    <Screen>
      <TopBar title="All transactions" />
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3" role="radiogroup" aria-label="Filter transactions">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`press flex h-8 items-center gap-1 rounded-lg border px-3 text-sm ${filter === f.id ? "border-text bg-text text-bg" : "border-line text-text"}`}
          >
            {filter === f.id && <Icon name="check" size={16} />}
            {f.label}
          </button>
        ))}
        <DemoBadge compact className="ml-auto" />
      </div>
      <ScrollBody className="pb-10">
        {groups.length === 0 && (
          <div className="flex flex-col items-center px-10 pt-20 text-center">
            <Icon name="receipt_long" size={48} className="text-text-3" />
            <p className="mt-4 text-base font-medium">No transactions yet</p>
            <p className="mt-1 text-sm text-text-2">Demo payments you make or receive will show up here.</p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.month}>
            <h2 className="sticky top-0 z-10 bg-bg px-5 pb-2 pt-5 text-[0.8125rem] font-medium text-text-3">{g.month}</h2>
            <ul>
              {g.items.map((t) => (
                <li key={t.id}>
                  <TxRow tx={t} contact={t.contactId ? byId.get(t.contactId) : undefined} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </ScrollBody>
    </Screen>
  );
}

function TxRow({ tx, contact }: { tx: Transaction; contact?: Contact }) {
  const sys = SYSTEM_ICONS[tx.method];
  const credit = tx.direction === "credit";
  return (
    <Link href={`/receipt/${tx.id}`} className="press flex items-center gap-4 px-5 py-3">
      {contact ? <ContactAvatar contact={contact} size={40} /> : <Avatar name={tx.counterpartyName} icon={sys?.icon} color={sys?.color ?? "#5f6368"} size={40} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem]">{tx.counterpartyName}</span>
        <span className="block truncate text-xs text-text-2">
          {tx.status === "reversed" ? "Failed · refunded · " : ""}
          {formatDay(tx.at)}
          {tx.note ? ` · ${tx.note}` : ""}
        </span>
      </span>
      <span className={`money text-[0.9375rem] ${tx.status === "reversed" ? "text-text-3 line-through" : credit ? "text-success" : "text-text"}`}>
        {formatMoney(credit ? tx.amount : -tx.amount, { sign: true }).replace(" ", "")}
      </span>
    </Link>
  );
}
