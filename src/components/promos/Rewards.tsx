"use client";
import { useEffect, useMemo, useState } from "react";
import { Stat } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Portal } from "@/components/ui/Portal";
import { Screen, ScreenSkeleton, ScrollBody } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { TopBar } from "@/components/ui/TopBar";
import { toast } from "@/components/ui/toast";
import { errorText, tpiApi } from "@/lib/api";
import { formatShort } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import type { Reward } from "@/lib/types";
import { ScratchCard } from "./ScratchCard";

export function Rewards() {
  const hydrated = useHydrated();
  const rewards = useStore((s) => s.rewards);
  const total = useMemo(() => rewards.reduce((sum, r) => sum + (r.scratched && r.amount ? r.amount : 0), 0), [rewards]);
  const [scratching, setScratching] = useState<Reward | null>(null);
  const [details, setDetails] = useState<Reward | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!scratching) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setScratching(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [scratching]);

  if (!hydrated) return <ScreenSkeleton />;

  return (
    <Screen>
      <TopBar title="Rewards" />
      <ScrollBody className="pb-10">
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          <Stat label="Total rewards" value={formatMoney(total)} tone="success" hint={<DemoBadge compact />} />
          <Stat label="To scratch" value={String(rewards.filter((r) => !r.scratched).length)} hint="Earn one per ₹10+ payment" />
        </div>

        <ul className="grid grid-cols-2 gap-3 p-3 @xl:grid-cols-3 @3xl:grid-cols-4">
          {rewards.map((r) => (
            <li key={r.id}>
              {r.scratched ? (
                <button type="button" onClick={() => setDetails(r)} className="press flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-surface-2 p-3 text-center">
                  {r.amount ? (
                    <>
                      <Icon name="trophy" filled size={40} className="text-[#F29900]" />
                      <span className="mt-2 text-xs text-text-2">You won</span>
                      <span className="money text-2xl font-medium text-success">{formatMoney(r.amount)}</span>
                    </>
                  ) : (
                    <>
                      <Icon name="sentiment_satisfied" size={40} className="text-text-3" />
                      <span className="mt-2 text-sm font-medium">Better luck</span>
                      <span className="text-xs text-text-2">next time</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRevealed(false);
                    setScratching(r);
                  }}
                  aria-label="Unscratched scratch card"
                  className="press relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#3b82ff] to-[#1f6ff2] text-white"
                >
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(255_255_255/0.25)_0_6px,transparent_7px),radial-gradient(circle_at_70%_60%,rgb(255_255_255/0.2)_0_5px,transparent_6px)] bg-[length:44px_44px]" />
                  <Icon name="redeem" size={44} className="relative" />
                  <span className="relative mt-2 text-xs font-medium">Scratch card</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        {rewards.length === 0 && <p className="px-6 pt-6 text-center text-sm text-text-2">Make a demo payment of ₹10 or more to earn your first scratch card.</p>}
      </ScrollBody>

      {scratching && (
        <Portal>
          <div className="animate-fade fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 px-6" role="dialog" aria-modal="true" aria-label="Scratch card">
            <IconButton icon="close" label="Close" autoFocus className="absolute right-2 top-2 text-white" onClick={() => setScratching(null)} />
            <div className="animate-pop">
              <ScratchCard
                onReveal={() => {
                  setRevealed(true);
                  // The win is credited by TacketPay's server, from the same mint as every demo rupee.
                  tpiApi.scratch(scratching.id).catch((err) => toast(errorText(err)));
                }}
              >
                <div className="flex size-full flex-col items-center justify-center bg-surface p-6 text-center">
                  {scratching.amount ? (
                    <>
                      <Icon name="trophy" filled size={56} className="text-[#F29900]" />
                      <p className="mt-3 text-sm text-text-2">You won</p>
                      <p className="money text-4xl font-medium text-success">{formatMoney(scratching.amount)}</p>
                      <p className="mt-2 text-xs text-text-2">{scratching.reason}</p>
                    </>
                  ) : (
                    <>
                      <Icon name="sentiment_satisfied" size={56} className="text-text-3" />
                      <p className="mt-3 text-xl font-medium">Better luck next time</p>
                      <p className="mt-2 text-xs text-text-2">{scratching.reason}</p>
                    </>
                  )}
                </div>
              </ScratchCard>
            </div>
            <p className="mt-6 min-h-12 text-center text-sm text-white" aria-live="polite">
              {revealed ? (scratching.amount ? `Hooray! ${formatMoney(scratching.amount)} in demo money was added to your balance.` : "No reward this time — keep paying to earn more cards.") : "Scratch the card to reveal your reward"}
            </p>
          </div>
        </Portal>
      )}

      <Sheet open={!!details} onClose={() => setDetails(null)}>
        {details && (
          <div className="px-6 pb-4 pt-4 text-center">
            <Icon name={details.amount ? "trophy" : "sentiment_satisfied"} filled={!!details.amount} size={56} className={details.amount ? "mx-auto text-[#F29900]" : "mx-auto text-text-3"} />
            <h2 className="mt-3 text-2xl font-medium">{details.amount ? "Hooray!" : "Better luck next time"}</h2>
            {details.amount && <p className="money mt-1 text-4xl font-medium text-success">{formatMoney(details.amount)}</p>}
            <p className="mt-3 text-sm text-text-2">{details.reason}</p>
            <p className="mt-1 text-xs text-text-3">
              Earned on {formatShort(details.at)} · Ref #: {details.id.slice(0, 10)}
            </p>
            <DemoBadge className="mt-4" />
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
