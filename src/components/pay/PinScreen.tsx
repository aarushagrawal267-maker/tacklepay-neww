"use client";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Keypad } from "@/components/ui/Keypad";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { formatMoney } from "@/lib/money";

const LENGTH = 4;

/**
 * The reference app's passcode screen (black, white dots, white keypad).
 * The demo PIN is the one chosen at sign-up; TacketPay's server checks it, never the switch.
 * Digits are kept only in component state and dropped as soon as they're handed over.
 */
export function PinScreen({
  title = "Enter demo PIN",
  bank,
  amount,
  payee,
  error,
  onDone,
  onCancel,
}: {
  title?: string;
  bank: string;
  amount?: number;
  payee?: string;
  /** Shown under the dots, e.g. after a wrong PIN. */
  error?: string;
  onDone: (pin: string) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (pin.length !== LENGTH) return;
    const t = window.setTimeout(() => {
      setPin("");
      onDone(pin);
    }, 180);
    return () => window.clearTimeout(t);
  }, [pin, onDone]);

  // Subscribe once: re-subscribing on every parent render (a background sync, say) can drop a keypress.
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  }, [onCancel]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < LENGTH ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") cancel.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="animate-screen fixed inset-0 z-50 flex flex-col bg-[var(--pin-bg)] text-[var(--pin-ink)]" role="dialog" aria-modal="true" aria-label={title}>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-1">
        <IconButton icon="arrow_back" label="Cancel" onClick={onCancel} />
        <span className="text-sm text-text-2">{bank}</span>
        <OverflowMenu items={[{ label: "Send feedback" }]} />
      </header>

      <div className="flex flex-1 flex-col items-center px-8 pt-6 text-center">
        {amount !== undefined && (
          <p className="text-sm text-text-2">
            {payee ? `Paying ${payee}` : "Paying"} <span className="money font-medium text-text">{formatMoney(amount)}</span>
          </p>
        )}
        <h2 className="mt-6 text-2xl font-medium">{title}</h2>
        <div className="mt-8 flex gap-5" aria-live="polite" aria-label={`${pin.length} of ${LENGTH} digits entered`}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <span
              key={i}
              className={`size-4 rounded-full border-2 border-[var(--pin-ink)] transition-[background,transform] duration-150 ${i < pin.length ? "scale-110 bg-[var(--pin-ink)]" : "bg-transparent"}`}
            />
          ))}
        </div>
        <p role="alert" className="mt-4 min-h-5 text-sm text-danger">
          {pin.length === 0 ? error : ""}
        </p>
        <p className="hidden text-xs text-text-3 sm:pointer-fine:block">Type your PIN on the keyboard · Esc to go back</p>
        <p className="mt-4 flex max-w-[18.75rem] items-start gap-2 rounded-xl bg-demo px-3.5 py-3 text-left text-[0.8125rem] leading-snug text-demo-ink">
          <Icon name="info" size={18} className="mt-px shrink-0" />
          Use the demo PIN you chose when you joined TacketPay. Never type a real UPI PIN or bank password here.
        </p>
      </div>

      <Keypad allowDecimal={false} onKey={(k) => setPin((p) => (k === "back" ? p.slice(0, -1) : /^\d$/.test(k) && p.length < LENGTH ? p + k : p))} />
    </div>
  );
}
