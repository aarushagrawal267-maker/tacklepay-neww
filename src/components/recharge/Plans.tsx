"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScrollBody } from "@/components/ui/Screen";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { formatMoney } from "@/lib/money";
import { OPERATORS, PLAN_TABS, type Plan } from "@/lib/seed";

/** Plan picker from the reference MobileRecharge + RechargeTab components. */
export function Plans() {
  const params = useSearchParams();
  const router = useRouter();
  const digits = (params.get("n") ?? "").replace(/\D/g, "").slice(0, 10);
  const contactName = params.get("name");
  const name = contactName ?? "Mobile number";
  const [tab, setTab] = useState(PLAN_TABS[0].id);
  const [query, setQuery] = useState("");
  // A stable "detected" operator per number, as real apps guess from the number series.
  const operator = OPERATORS[(Number(digits.slice(0, 4)) || 0) % OPERATORS.length];

  const plans = useMemo(() => {
    const q = query.trim();
    if (!q) return PLAN_TABS.find((t) => t.id === tab)!.plans;
    const all = PLAN_TABS.flatMap((t) => t.plans);
    return all.filter((p) => String(p.amount).includes(q) || p.description.toLowerCase().includes(q.toLowerCase()));
  }, [tab, query]);

  const choose = (plan: Plan) => {
    const q = new URLSearchParams({
      am: String(plan.amount * 100),
      lock: "1",
      method: "recharge",
      tn: `Recharge +91 ${digits}`,
      detail: `+91 ${digits.slice(0, 5)} ${digits.slice(5)} · ${plan.validity}`,
    });
    // Operators are shops on the Tacket participant; the id matches the server's.
    router.push(`/pay/op-${operator.id}?${q}`);
  };

  const customAmount = /^\d{2,4}$/.test(query.trim()) ? Number(query.trim()) : null;

  if (digits.length !== 10) {
    return (
      <Screen>
        <TopBar title="Mobile recharge" fallback="/recharge" />
        <p className="p-6 text-sm text-text-2">Enter a 10-digit number first.</p>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar
        fallback="/recharge"
        title={
          <span className="flex items-center gap-3">
            <Avatar name={name} icon={contactName ? undefined : "person"} color={operator.color} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{name}</span>
              <span className="block truncate text-xs font-normal text-text-2">
                +91 {digits.slice(0, 5)} {digits.slice(5)} · {operator.name}
              </span>
            </span>
          </span>
        }
        menu={[{ label: "Refresh", onSelect: () => toast("Plans are up to date") }, { label: "Send feedback" }]}
      />
      <div className="shrink-0 bg-surface px-5 pt-4">
        <p className="text-sm text-text-2">Pick a plan below to get started.</p>
        <label className="mt-3 flex h-11 items-center gap-2 rounded-[0.625rem] border border-line bg-surface-2 px-3 focus-within:border-primary-fg">
          <Icon name="search" className="text-text-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.slice(0, 30))}
            placeholder="Search for plan or enter amount"
            aria-label="Search for plan or enter amount"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[0.9375rem] placeholder:text-text-3"
          />
        </label>
      </div>
      {!query && (
        <div role="tablist" className="mx-4 mt-3 flex shrink-0 flex-wrap gap-1 rounded-xl bg-surface-3 p-1 dark:bg-surface-2">
          {PLAN_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-8 shrink-0 rounded-lg px-3 text-[0.8125rem] font-medium ${tab === t.id ? "border border-line bg-surface text-text shadow-e1 dark:border-line-strong dark:bg-surface-2" : "text-text-2"}`}
            >
              {t.label}
              
            </button>
          ))}
        </div>
      )}
      <ScrollBody>
        <ul className="divide-y divide-line">
          {customAmount && (
            <li>
              <button type="button" onClick={() => choose({ amount: customAmount, validity: "Custom amount", description: "Talktime top-up" })} className="press flex w-full items-center gap-4 px-5 py-4 text-left">
                <span className="money text-xl font-medium">{formatMoney(customAmount * 100)}</span>
                <span className="flex-1 text-sm text-text-2">Recharge this amount</span>
                <Icon name="chevron_right" />
              </button>
            </li>
          )}
          {plans.map((p) => (
            <li key={`${p.amount}-${p.validity}`}>
              <button type="button" onClick={() => choose(p)} className="press flex w-full items-start gap-4 px-5 py-4 text-left">
                <span className="money w-20 shrink-0 text-xl font-medium">{formatMoney(p.amount * 100)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-text-2">
                    Validity: <span className="text-text">{p.validity}</span>
                  </span>
                  <span className="mt-1 block text-[0.8125rem] leading-snug text-text-2">{p.description}</span>
                </span>
                <Icon name="chevron_right" className="mt-1 shrink-0" />
              </button>
            </li>
          ))}
          {plans.length === 0 && !customAmount && <li className="px-5 py-8 text-sm text-text-2">No plans match “{query}”.</li>}
        </ul>
      </ScrollBody>
    </Screen>
  );
}
