"use client";
import { Avatar, ContactAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/Logo";
import { Sheet } from "@/components/ui/Sheet";
import { formatMoney } from "@/lib/money";
import type { Account, Contact } from "@/lib/types";

/** "Process to pay" sheet: who, how much, and which demo account pays. */
export function ConfirmSheet({
  open,
  onClose,
  contact,
  me,
  amount,
  note,
  accounts,
  accountId,
  onAccount,
  handle,
  error,
  detail,
  onPay,
}: {
  open: boolean;
  onClose: () => void;
  contact: Contact;
  me: string;
  amount: number;
  note?: string;
  accounts: Account[];
  accountId: string;
  onAccount: (id: string) => void;
  handle: string;
  error?: string;
  detail?: React.ReactNode;
  onPay: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-6 pb-2 pt-4">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            <Avatar name={me} color="#1f6ff2" size={40} />
            <Icon name="arrow_forward" className="text-text-3" />
            <ContactAvatar contact={contact} size={40} />
          </div>
          <p className="mt-2 text-sm text-text-2">Paying {contact.name}</p>
          <p className="money mt-1 text-[2.375rem] font-medium leading-tight">{formatMoney(amount)}</p>
          {note && <p className="text-sm text-text-2">“{note}”</p>}
          {detail}
        </div>

        <fieldset className="mt-6">
          <legend className="text-[0.8125rem] font-medium text-text-3">Choose account to pay with</legend>
          <div className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-surface-2">
            {accounts.map((a) => (
              <label key={a.id} className="press flex cursor-pointer items-center gap-3 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl">
                <span className="grid size-10 place-items-center rounded-[0.625rem] bg-surface text-text-2 dark:bg-surface-3">
                  <Icon name="account_balance" size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium">
                    {a.bank} {a.last4}
                  </span>
                  <span className="block text-xs text-text-2">
                    {a.type} · {handle}
                  </span>
                </span>
                <input
                  type="radio"
                  name="account"
                  checked={a.id === accountId}
                  onChange={() => onAccount(a.id)}
                  className="size-5 accent-[var(--primary)]"
                  aria-label={`${a.bank} ${a.last4}`}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <p role="alert" className="mt-3 min-h-5 text-center text-sm font-medium text-danger">
          {error}
        </p>

        <Button size="lg" block className="mt-1" onClick={onPay} data-autofocus>
          Proceed to pay
        </Button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-text-3">
          Sent over <LogoMark size={14} /> TPI · demo money only
        </p>
      </div>
    </Sheet>
  );
}
