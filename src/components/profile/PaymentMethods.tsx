"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge, DemoNotice } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScreenSkeleton, ScrollBody } from "@/components/ui/Screen";
import { Dialog, Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { errorText, tpiApi } from "@/lib/api";
import { useHydrated, useStore } from "@/lib/store";
import type { Account } from "@/lib/types";
import addCardImg from "../../../public/images/add-card.jpg";

/** Runs an account change on the server and confirms it with a toast. */
async function attempt(change: () => Promise<unknown>, done: string) {
  try {
    await change();
    toast(done);
  } catch (err) {
    toast(errorText(err));
  }
}

export function PaymentMethods() {
  const router = useRouter();
  const hydrated = useHydrated();
  const accounts = useStore((s) => s.accounts);
  const cards = useStore((s) => s.cards);
  const handle = useStore((s) => s.profile.handle);
  const [selected, setSelected] = useState<Account | null>(null);
  const [cardDialog, setCardDialog] = useState(false);

  if (!hydrated) return <ScreenSkeleton />;

  return (
    <Screen>
      <TopBar title="Payment methods" />
      <ScrollBody className="px-5 pb-10 pt-6">
        <h2 className="text-[0.8125rem] font-medium text-text-3">Bank accounts</h2>
        <ul className="mt-3 space-y-1">
          {accounts.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => setSelected(a)} className="press -mx-2 flex w-[calc(100%+16px)] items-center gap-4 rounded-2xl px-2 py-3 text-left">
                <span className="grid size-10 shrink-0 place-items-center rounded-[0.625rem] bg-surface-3 text-text-2">
                  <Icon name="account_balance" size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {a.bank} {a.last4}
                  </span>
                  <span className="block text-sm text-text-2">{a.type}</span>
                  <span className="block truncate text-sm text-text-2">{handle}</span>
                  {a.primary && (
                    <Badge tone="success" className="mt-1.5">Primary account</Badge>
                  )}
                </span>
                <Icon name="chevron_right" className="text-text-2" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void attempt(tpiApi.addAccount, "Demo bank account added")}
          className="press mt-3 flex items-center gap-3 rounded-xl py-2 text-[0.9375rem] font-medium text-primary-fg"
        >
          <span className="grid size-10 place-items-center rounded-[0.625rem] border border-dashed border-primary-fg">
            <Icon name="add" />
          </span>
          Add bank account
        </button>

        <hr className="my-6 border-line" />

        <h2 className="text-[0.8125rem] font-medium text-text-3">Cards</h2>
        {cards.length > 0 && (
          <ul className="mt-3 space-y-3">
            {cards.map((c) => (
              <li key={c.id} className="flex items-center gap-4">
                <span className="grid size-10 place-items-center rounded-[0.625rem] bg-gradient-to-br from-[#3b82ff] to-[#0f4fc2] text-white">
                  <Icon name="credit_card" size={22} />
                </span>
                <span>
                  <span className="block text-sm font-bold">
                    {c.label} •••• {c.last4}
                  </span>
                  <span className="block text-xs text-text-2">For tap, online and QR payments · demo</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => setCardDialog(true)} className="press mt-3 flex items-center gap-3 rounded-xl py-2 text-[0.9375rem] font-medium text-primary-fg">
          <span className="grid size-10 place-items-center rounded-[0.625rem] border border-dashed border-primary-fg">
            <Icon name="add_card" />
          </span>
          Add card
        </button>
        <p className="mt-1 pl-[3.25rem] text-xs text-text-2">Demo Visa-style credit/debit supported</p>

        <DemoNotice className="mt-8">Accounts and cards here are fictional. Never add real bank or card numbers to TacketPay.</DemoNotice>
      </ScrollBody>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.bank} ${selected.last4}` : undefined}>
        {selected && (
          <div className="py-2">
            <button type="button" className="press flex h-14 w-full items-center gap-4 px-6 text-left" onClick={() => router.push(`/balance?account=${selected.id}`)}>
              <Icon name="account_balance" className="text-text-2" /> Check balance
            </button>
            <button
              type="button"
              disabled={selected.primary}
              className="press flex h-14 w-full items-center gap-4 px-6 text-left disabled:opacity-50"
              onClick={() => {
                void attempt(() => tpiApi.setPrimary(selected.id), "Primary account updated");
                setSelected(null);
              }}
            >
              <Icon name="check_circle" className="text-text-2" /> {selected.primary ? "Already your primary account" : "Make primary account"}
            </button>
          </div>
        )}
      </Sheet>

      <Dialog
        open={cardDialog}
        onClose={() => setCardDialog(false)}
        title="Add card to pay"
        actions={
          <>
            <Button variant="text" onClick={() => setCardDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="text"
              data-autofocus
              onClick={() => {
                void attempt(tpiApi.addCard, "Demo card added");
                setCardDialog(false);
              }}
            >
              Proceed
            </Button>
          </>
        }
      >
        <Image src={addCardImg} alt="" className="-mx-1 mb-4 rounded-2xl" sizes="300px" />
        Your demo card can be used for tap, online and QR code payments inside TacketPay. A random demo number is generated — no real card details are asked for.
      </Dialog>
    </Screen>
  );
}
