"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { toast } from "@/components/ui/toast";
import { useBack } from "@/components/ui/TopBar";
import { formatMoney } from "@/lib/money";
import { colorFor, BILL_CATEGORIES } from "@/lib/seed";
import { useStore } from "@/lib/store";

const SUGGESTED = BILL_CATEGORIES.flatMap((c) => c.providers.slice(0, 1).map((p) => ({ ...p, categoryId: c.id })));

export function Bills() {
  const back = useBack("/explore");
  const linked = useStore((s) => s.linkedBills);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return BILL_CATEGORIES.flatMap((c) => c.providers.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ ...p, categoryId: c.id, category: c.name })));
  }, [query]);

  return (
    <div className="animate-screen flex h-full flex-col bg-bg">
      <header className="z-10 flex h-16 shrink-0 items-center gap-1 border-b border-line bg-bg px-1">
        <IconButton icon="arrow_back" label="Back" onClick={back} />
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[0.625rem] border border-line bg-surface-2 px-3 focus-within:border-primary-fg">
          <Icon name="search" className="text-text-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for service providers"
            aria-label="Search for service providers"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[0.9375rem] placeholder:text-text-3"
          />
        </label>
        <OverflowMenu items={[{ label: "Refresh", onSelect: () => toast("Up to date") }, { label: "Send feedback" }]} />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto pb-10">
        {query ? (
          <ul className="px-4 py-3">
            {results.length === 0 && <li className="px-2 py-6 text-sm text-text-2">No billers match “{query}”.</li>}
            {results.map((p) => (
              <li key={p.id}>
                <ProviderRow href={`/bills/${p.categoryId}/${p.id}`} name={p.name} detail={p.category} />
              </li>
            ))}
          </ul>
        ) : (
          <>
            {linked.length > 0 && (
              <section className="px-5 pt-5">
                <h2 className="text-[1.0625rem] font-medium">Your billers</h2>
                <ul className="mt-3 space-y-2">
                  {linked.map((b) => (
                    <li key={b.id}>
                      <Link href={`/bills/${b.categoryId}/${b.providerId}`} className="press flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                        <Avatar name={b.providerName} color={colorFor(b.providerName)} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{b.label ?? b.providerName}</span>
                          <span className="block truncate text-xs text-text-2">{b.accountNumber}</span>
                        </span>
                        <span className={`money text-sm ${b.dueAmount ? "text-due" : "text-success"}`}>{b.dueAmount ? `${formatMoney(b.dueAmount)} due` : "Paid"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="pt-5">
              <h2 className="px-5 text-[1.0625rem] font-medium">Suggested for you</h2>
              {/* A wrapping grid rather than a sideways scroller, so nothing is cut off at the edge. */}
              <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4 px-4 @2xl:grid-cols-6">
                {SUGGESTED.map((p) => (
                  <li key={p.id} className="min-w-0">
                    <Link href={`/bills/${p.categoryId}/${p.id}`} className="press flex flex-col items-center gap-2 rounded-xl py-1.5">
                      <Avatar name={p.name} color={colorFor(p.name)} size={48} />
                      <span className="line-clamp-2 w-full px-0.5 text-center text-[0.8125rem] leading-tight">{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
            <section className="px-4 pt-5">
              <h2 className="px-1 text-[1.0625rem] font-medium">Pay your bills and DTH</h2>
              <ul className="mt-2 divide-y divide-line">
                {BILL_CATEGORIES.map((c) => (
                  <li key={c.id}>
                    <Link href={`/bills/${c.id}`} className="press flex items-center gap-3 rounded-xl px-1 py-3">
                      <span className="grid size-11 place-items-center rounded-[0.75rem] bg-surface-2 text-text-2 dark:bg-surface-3">
                        <Icon name={c.icon} size={24} />
                      </span>
                      <span className="text-sm">{c.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export function ProviderRow({ href, name, detail }: { href: string; name: string; detail: string }) {
  return (
    <Link href={href} className="press -mx-2 flex items-center gap-4 rounded-xl px-2 py-3">
      <Avatar name={name} color={colorFor(name)} size={44} />
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem]">{name}</span>
        <span className="block truncate text-[0.8125rem] text-text-2">{detail}</span>
      </span>
    </Link>
  );
}
