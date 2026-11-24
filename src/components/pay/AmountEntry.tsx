"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar, ContactAvatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { Keypad } from "@/components/ui/Keypad";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { CURRENCY_SYMBOL, groupTyped, pressAmountKey } from "@/lib/money";
import type { Contact } from "@/lib/types";

/**
 * Full-bleed blue amount screen from the reference PayComponent: me → them avatars,
 * a huge amount, a "What is this for?" note pill, a round next button and a white keypad.
 */
export function AmountEntry({
  contact,
  me,
  mode,
  text,
  onText,
  note,
  onNote,
  error,
  locked,
  keyboard = true,
  onNext,
  onClose,
}: {
  contact: Contact;
  me: string;
  mode: "pay" | "request";
  text: string;
  onText: (t: string) => void;
  note: string;
  onNote: (n: string) => void;
  error?: string;
  locked?: boolean;
  /** Off while the confirm sheet or PIN screen is on top, so typed PIN digits don't change the amount. */
  keyboard?: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);
  const amountId = useId();
  const valid = Number(text) > 0;

  useEffect(() => {
    if (editingNote) noteRef.current?.focus();
  }, [editingNote]);

  // Physical keyboard support for desktop testing.
  useEffect(() => {
    if (locked || !keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if (editingNote || (e.target as HTMLElement).tagName === "INPUT") return;
      if (/^[\d.]$/.test(e.key)) onText(pressAmountKey(text, e.key));
      else if (e.key === "Backspace") onText(pressAmountKey(text, "back"));
      else if (e.key === "Enter" && valid) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [text, onText, editingNote, valid, onNext, locked, keyboard]);

  const size = text.length > 7 ? "text-[2.125rem]" : text.length > 5 ? "text-[2.5rem]" : "text-[3rem]";

  return (
    <div className="animate-fade flex h-full flex-col bg-bg text-text">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-1">
        <IconButton icon="close" label="Close" onClick={onClose} />
        <OverflowMenu items={[{ label: "Send feedback" }]} />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex items-center gap-2">
          <Avatar name={me} color="#1f6ff2" size={44} />
          <Icon name={mode === "pay" ? "arrow_forward" : "arrow_back"} className="text-text-3" />
          <ContactAvatar contact={contact} size={44} />
        </div>
        <p className="mt-3 text-[0.9375rem]">
          {mode === "pay" ? "Paying" : "Requesting from"} {contact.name}
        </p>
        <p className="text-[0.8125rem] text-text-3">{contact.handle}</p>

        <label htmlFor={amountId} className="sr-only">
          Amount in rupees
        </label>
        <output id={amountId} aria-live="polite" className={`money mt-6 font-medium leading-none ${size}`}>
          {CURRENCY_SYMBOL}
          {groupTyped(text) || <span className="text-text-3">0</span>}
        </output>
        <DemoBadge className="mt-3" />
        <span className="sr-only">Demo money, no real payment</span>

        {editingNote ? (
          <input
            ref={noteRef}
            value={note}
            onChange={(e) => onNote(e.target.value.slice(0, 60))}
            onBlur={() => setEditingNote(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingNote(false)}
            placeholder="What is this for?"
            aria-label="Note"
            className="mt-5 h-11 w-[15rem] max-w-full rounded-[0.625rem] border border-primary-fg bg-surface px-4 text-center text-base text-text outline-none ring-3 ring-primary-fg/15 placeholder:text-text-3"
          />
        ) : (
          <button type="button" onClick={() => setEditingNote(true)} className="press mt-5 flex h-11 max-w-[16.25rem] items-center gap-2 truncate rounded-[0.625rem] border border-button-line bg-button px-4 text-[0.9375rem] text-text-2 shadow-e1">
            <Icon name="edit" size={18} />
            {note || "What is this for?"}
          </button>
        )}

        <p role="alert" className="mt-3 min-h-5 text-sm font-medium text-danger">
          {error}
        </p>

        <button
          type="button"
          onClick={onNext}
          disabled={!valid}
          aria-label={mode === "pay" ? "Continue to pay" : "Send request"}
          className="press mt-1 flex h-12 min-w-[11.25rem] items-center justify-center gap-1 rounded-[0.625rem] bg-[linear-gradient(180deg,var(--primary-hi),var(--primary))] px-6 text-[0.9375rem] font-medium text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)] transition-opacity disabled:opacity-40"
        >
          {mode === "pay" ? "Continue" : "Send request"}
          <Icon name={mode === "pay" ? "chevron_right" : "send"} size={20} />
        </button>
        {!locked && <p className="mt-3 hidden text-xs text-text-3 sm:pointer-fine:block">Type the amount on your keyboard · Enter to continue</p>}
      </div>

      {!locked && (
        <div className="border-t border-line bg-surface-2 text-text sm:pointer-fine:hidden">
          <Keypad onKey={(k) => onText(pressAmountKey(text, k))} />
        </div>
      )}
    </div>
  );
}
