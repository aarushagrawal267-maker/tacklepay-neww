"use client";
import Image from "next/image";
import { useState } from "react";
import { PinScreen } from "@/components/pay/PinScreen";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScreenSkeleton, ScrollBody } from "@/components/ui/Screen";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { ERROR_COPY } from "@/lib/actions";
import { ApiError, errorText, tpiApi } from "@/lib/api";
import { CURRENCY_SYMBOL, formatMoney, parseAmount } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import moneyTransferImg from "../../../public/images/money-transfer.png";

/** Self transfer between your own demo accounts (reference SelfTransferComponent, made functional). */
export function SelfTransfer() {
  const hydrated = useHydrated();
  const accounts = useStore((s) => s.accounts);
  const handle = useStore((s) => s.profile.handle);
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pin, setPin] = useState(false);
  const [pinError, setPinError] = useState<string>();

  if (!hydrated) return <ScreenSkeleton />;
  const fromId = from ?? accounts[0]?.id;
  const toId = to ?? accounts.find((a) => a.id !== fromId)?.id;
  const amount = parseAmount(text) ?? 0;

  const start = () => {
    const src = accounts.find((a) => a.id === fromId);
    if (!amount) return setError(ERROR_COPY.INVALID_AMOUNT);
    if (!src || fromId === toId) return setError("Pick two different accounts");
    if (src.balance < amount) return setError(ERROR_COPY.INSUFFICIENT_FUNDS);
    setError(undefined);
    setPinError(undefined);
    setPin(true);
  };

  const finish = async (code: string) => {
    try {
      await tpiApi.selfTransfer({ fromId: fromId!, toId: toId!, amount, pin: code });
    } catch (err) {
      if (err instanceof ApiError && err.code === "PIN_INVALID") return setPinError(errorText(err));
      setPin(false);
      return setError(errorText(err));
    }
    setPin(false);
    setText("");
    toast(`Moved ${formatMoney(amount)} between your demo accounts`);
  };

  const addAccount = async () => {
    try {
      await tpiApi.addAccount();
      toast("Demo bank account added");
    } catch (err) {
      toast(errorText(err));
    }
  };

  const select = (label: string, value: string | undefined, onChange: (v: string) => void) => (
    <label className="block">
      <span className="text-xs text-text-2">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-12 w-full rounded-[0.625rem] border border-line bg-surface px-3 text-sm text-text">
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.bank} {a.last4} · {formatMoney(a.balance)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Screen>
      <TopBar title="Self transfer" />
      <ScrollBody className="px-5 pb-10 pt-5">
        <p className="text-[0.8125rem]">Manage your money better by adding another account to make self-transfers.</p>
        <ul className="mt-6 space-y-5">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[0.625rem] bg-surface-3 text-text-2">
                <Icon name="account_balance" size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {a.bank} {a.last4}
                </span>
                <span className="block text-sm text-text-2">{a.type}</span>
                <span className="block truncate text-sm text-text-2">{handle}</span>
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void addAccount()}
          className="press mt-6 flex items-center gap-3 rounded-xl py-1 text-[0.9375rem] font-medium text-primary-fg"
        >
          <span className="grid size-10 place-items-center rounded-[0.625rem] border border-dashed border-primary-fg">
            <Icon name="add" />
          </span>
          Add bank account
        </button>

        {accounts.length > 1 ? (
          <section className="mt-8 space-y-4 rounded-2xl bg-surface-2 p-5">
            <h2 className="text-base font-medium">Move demo money</h2>
            {select("From", fromId, (v) => setFrom(v))}
            {select("To", toId, (v) => setTo(v))}
            <label className="money flex h-14 items-center gap-1 rounded-[0.625rem] border border-line bg-surface px-4 text-2xl font-medium focus-within:border-primary-fg">
              {CURRENCY_SYMBOL}
              <input
                inputMode="decimal"
                value={text}
                onChange={(e) => {
                  setText(e.target.value.replace(/[^\d.]/g, "").slice(0, 9));
                  setError(undefined);
                }}
                placeholder="0"
                aria-label="Amount"
                className="money min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            <p role="alert" className="min-h-5 text-sm text-danger">
              {error}
            </p>
            <Button block onClick={start} disabled={!amount}>
              Transfer
            </Button>
          </section>
        ) : (
          <Image src={moneyTransferImg} alt="" className="mx-auto mt-10 opacity-90 dark:hidden" />
        )}
      </ScrollBody>
      {pin && (
        <PinScreen
          bank={accounts.find((a) => a.id === fromId)?.bank ?? "Demo bank"}
          amount={amount}
          payee="yourself"
          error={pinError}
          onDone={finish}
          onCancel={() => setPin(false)}
        />
      )}
    </Screen>
  );
}
