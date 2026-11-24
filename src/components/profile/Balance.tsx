"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PinScreen } from "@/components/pay/PinScreen";
import { Button } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScreenSkeleton } from "@/components/ui/Screen";
import { TopBar, useBack } from "@/components/ui/TopBar";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";

/** "Check account balance": demo PIN first, then the balance — the same ritual as the real thing. */
export function Balance() {
  const params = useSearchParams();
  const router = useRouter();
  const back = useBack("/");
  const hydrated = useHydrated();
  const accounts = useStore((s) => s.accounts);
  const [unlocked, setUnlocked] = useState(false);
  // Hidden routes stay mounted; ask for the PIN again on every visit.
  useEffect(() => () => setUnlocked(false), []);

  if (!hydrated) return <ScreenSkeleton />;
  const account = accounts.find((a) => a.id === params.get("account")) ?? accounts.find((a) => a.primary) ?? accounts[0];

  if (!unlocked) {
    return <PinScreen title="Enter demo PIN" bank={`${account.bank} ${account.last4}`} onDone={() => setUnlocked(true)} onCancel={back} />;
  }

  return (
    <Screen>
      <TopBar title="Account balance" nav="close" />
      <div className="flex flex-1 flex-col items-center px-6 pt-10 text-center">
        <span className="animate-pop grid size-16 place-items-center rounded-2xl bg-surface-2 text-text-2">
          <Icon name="account_balance" size={34} />
        </span>
        <p className="mt-4 text-sm text-text-2">
          {account.bank} •••• {account.last4} · {account.type}
        </p>
        <p className="mt-6 text-sm text-text-2">Available balance</p>
        <p className="money animate-rise mt-1 text-[2.5rem] font-medium leading-tight">{formatMoney(account.balance, { fixed: true })}</p>
        <DemoBadge className="mt-3" />
        <p className="mt-6 max-w-[18.125rem] text-sm text-text-2">This is play money for trying TacketPay. It can&apos;t be withdrawn or sent to a real bank.</p>
        {accounts.length > 1 && (
          <ul className="mt-8 w-full divide-y divide-line rounded-2xl bg-surface-2 text-left">
            {accounts
              .filter((a) => a.id !== account.id)
              .map((a) => (
                <li key={a.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    {a.bank} {a.last4}
                  </span>
                  <span className="money">{formatMoney(a.balance)}</span>
                </li>
              ))}
          </ul>
        )}
        <div className="mt-auto flex w-full gap-3 pb-8 pt-6">
          <Button variant="outlined" size="lg" icon="add" className="flex-1" onClick={() => router.push("/add-money")}>
            Add money
          </Button>
          <Button size="lg" className="flex-1" onClick={() => router.replace("/")}>
            Done
          </Button>
        </div>
      </div>
    </Screen>
  );
}
