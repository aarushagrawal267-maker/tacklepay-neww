"use client";
import { useMemo, useState } from "react";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScrollBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { useStore } from "@/lib/store";
import type { Contact } from "@/lib/types";

const digitsOf = (s: string) => s.replace(/\D/g, "").slice(-10);

/**
 * "ENTER MOBILE NUMBER" screen shared by Mobile recharge and Pay phone number
 * (reference RechargeLinkNumber / PhoneNumber components): +91 prefix, live contact
 * filtering, and a round next button once ten digits are in.
 */
export function NumberEntry({
  title,
  hint = "Any 10-digit number works — it's demo money.",
  onPick,
}: {
  title: string;
  hint?: string;
  onPick: (digits: string, contact?: Contact) => void;
}) {
  const contacts = useStore((s) => s.contacts);
  const [value, setValue] = useState("");
  const digits = value.replace(/\D/g, "");
  const people = useMemo(() => contacts.filter((c) => c.kind === "person" && c.phone), [contacts]);
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return people;
    return people.filter((c) => digitsOf(c.phone!).includes(digits || "\u0000") || c.name.toLowerCase().includes(q));
  }, [people, value, digits]);
  const ready = digits.length === 10;

  return (
    <Screen className="relative">
      <TopBar title={title} />
      <ScrollBody className="px-5 pb-28 pt-6">
        <label htmlFor="phone" className="text-[0.8125rem] font-medium text-text-3">
          Enter mobile number
        </label>
        <div className="mt-4 flex items-end gap-3">
          <span className="money border-b border-line-strong pb-2 text-lg text-text-2">+91</span>
          <input
            id="phone"
            autoFocus
            inputMode="tel"
            autoComplete="tel-national"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d\sA-Za-z]/g, "").slice(0, 24))}
            onKeyDown={(e) => e.key === "Enter" && ready && onPick(digits)}
            placeholder="Number or name"
            className="money h-11 min-w-0 flex-1 border-b-2 border-primary-fg bg-transparent text-xl text-text outline-none placeholder:font-sans placeholder:text-base placeholder:text-text-3"
          />
          <Icon name="contacts" className="mb-2 text-text-2" />
        </div>
        <p className="mt-2 text-xs text-text-2">{hint}</p>

        <ul className="mt-5">
          {matches.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(digitsOf(c.phone!), c)} className="press -mx-2 flex w-[calc(100%+16px)] items-center gap-5 rounded-2xl px-2 py-2.5 text-left">
                <ContactAvatar contact={c} size={44} />
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem]">{c.name}</span>
                  <span className="money block truncate text-[0.8125rem] text-text-2">{c.phone}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </ScrollBody>
      <button
        type="button"
        onClick={() => ready && onPick(digits)}
        disabled={!ready}
        aria-label="Continue"
        className={`press absolute bottom-6 right-5 grid size-14 place-items-center rounded-2xl shadow-e2 transition-colors ${ready ? "bg-[linear-gradient(180deg,var(--primary-hi),var(--primary))] text-white" : "bg-surface-3 text-text-3"}`}
      >
        <Icon name="chevron_right" size={30} />
      </button>
    </Screen>
  );
}
