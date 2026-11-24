"use client";
import { useMemo, useState } from "react";
import { ContactAvatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/toast";
import { useBack } from "@/components/ui/TopBar";
import { useStore } from "@/lib/store";

/** Referrals screen from the reference ReferralsComponent: search, earnings header, code card, invite list. */
export function Referrals() {
  const back = useBack("/");
  const code = useStore((s) => s.referralCode);
  const contacts = useStore((s) => s.contacts);
  const [query, setQuery] = useState("");
  const people = useMemo(
    () => contacts.filter((c) => c.kind === "person" && c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [contacts, query],
  );

  const share = async (to?: string) => {
    const text = `${to ? `Hi ${to}! ` : ""}Try TacketPay — a payments app that runs on demo money. Use my code ${code}.`;
    try {
      if (navigator.share) await navigator.share({ title: "TacketPay", text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        toast("Invite copied");
      }
    } catch {
      // Dismissed.
    }
  };

  return (
    <div className="animate-screen flex h-full flex-col bg-bg">
      <header className="z-10 flex h-16 shrink-0 items-center gap-1 border-b border-line bg-bg px-1">
        <IconButton icon="arrow_back" label="Back" onClick={back} />
        <label className="mr-2 flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[0.625rem] border border-line bg-surface-2 px-3 focus-within:border-primary-fg">
          <Icon name="search" className="text-text-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends"
            aria-label="Search friends"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[0.9375rem] placeholder:text-text-3"
          />
        </label>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto pb-10">
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          <Stat label="Earned" value="₹51" tone="success" hint="For referring 1 friend · demo" />
          <Stat label="Per friend" value="₹201" hint="After their first payment" />
        </div>
        <section className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-5">
          <span className="grid size-10 place-items-center rounded-[0.625rem] bg-surface text-text-2 dark:bg-surface-3">
            <Icon name="redeem" />
          </span>
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                toast(`${code} copied to clipboard`);
              } catch {
                toast("Couldn't copy");
              }
            }}
          >
            <span className="money block text-lg font-medium tracking-widest">{code}</span>
            <span className="block text-xs text-text-2">Your referral code · tap to copy</span>
          </button>
          <button type="button" onClick={() => share()} className="press h-9 rounded-[0.625rem] bg-[linear-gradient(180deg,var(--primary-hi),var(--primary))] px-4 text-sm font-medium text-white">
            Share
          </button>
        </section>
        <h2 className="px-5 pb-1 pt-5 text-[0.8125rem] font-medium text-text-3">Invite friends</h2>
        <ul>
          {people.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-2.5">
              <ContactAvatar contact={c} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs text-text-2">{c.phone ?? c.handle}</span>
              </span>
              <button type="button" onClick={() => share(c.name)} className="press flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-button-line bg-button px-3.5 text-sm shadow-e1">
                Invite
              </button>
            </li>
          ))}
          {people.length === 0 && <li className="px-5 py-6 text-sm text-text-2">No friends match “{query}”.</li>}
        </ul>
      </main>
    </div>
  );
}
