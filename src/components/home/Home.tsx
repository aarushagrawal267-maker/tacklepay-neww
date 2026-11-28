"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Avatar, ContactAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { toast } from "@/components/ui/toast";
import { formatDay, formatTime } from "@/lib/format";
import { useBusinesses, useRecentPeople } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import type { Transaction } from "@/lib/types";
import { HomeIllustration } from "./HomeIllustration";

const CHIPS: { href: string; label: string; icon: IconName }[] = [
  { href: "/recharge", label: "Recharges", icon: "mobile" },
  { href: "/bills", label: "Bills", icon: "receipt_long" },
  { href: "/explore?tab=businesses", label: "Spots", icon: "storefront" },
];

/**
 * Home in the Google Pay arrangement — scan / logo / profile bar, illustrated band, a rounded
 * sheet with People, Businesses & bills and Promotions, and a floating "New payment" pill —
 * dressed in the Tacket ledger style.
 */
export function Home({ onOpenScanner }: { onOpenScanner: () => void }) {
  const name = useStore((s) => s.profile.name);
  const hydrated = useHydrated();
  const scroller = useRef<HTMLDivElement>(null);
  const [fabVisible, setFabVisible] = useState(true);

  // Hide the floating button while scrolling down, bring it back on the way up.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let last = el.scrollTop;
    const onScroll = () => {
      const y = el.scrollTop;
      if (Math.abs(y - last) < 8) return;
      setFabVisible(y < last || y < 40);
      last = y;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const invite = useCallback(async () => {
    const text = "Try TacketPay — a payments app that runs on demo money. Nothing real ever moves.";
    try {
      if (navigator.share) await navigator.share({ title: "TacketPay", text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        toast("Invite link copied");
      }
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <header className="relative z-10 grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-2">
        <button type="button" onClick={onOpenScanner} aria-label="Scan QR code" className="press grid size-10 place-items-center rounded-[0.625rem] text-text-2">
          <Icon name="qr_code_scanner" size={22} />
        </button>
        {/* From 1024px the side nav shows the wordmark and demo badge, so the header hides its copy there. */}
        <span className="flex items-center gap-1.5 lg:invisible">
          <LogoMark size={20} />
          <Wordmark className="text-[1.0625rem]" />
          <DemoBadge compact className="ml-1" />
        </span>
        <span className="flex items-center justify-end gap-0.5">
          <ThemeToggle className="sm:hidden" />
          <Link href="/profile" aria-label="Profile" className="press rounded-full p-1">
            {hydrated ? <Avatar name={name || "You"} size={30} className="!rounded-full" /> : <span className="skeleton block size-[1.875rem] rounded-full" />}
          </Link>
        </span>
      </header>

      <div ref={scroller} className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <HomeIllustration className="block h-[8.25rem] w-full" />

        <div className="relative -mt-5 min-h-full rounded-t-[1.5rem] border-t border-line bg-bg px-5 pb-32 pt-7 shadow-[0_-6px_20px_rgb(16_24_40/0.04)]">
          <PeopleSection />
          <BusinessSection />
          <PromotionsSection />
          <AccountSection />
          <ActivitySection />

          <section className="mt-8 flex items-center gap-4 rounded-2xl bg-surface-2 p-5">
            <div className="min-w-0 flex-1">
              <h2 className="text-[0.9375rem] font-medium">Invite your friends</h2>
              <p className="mt-1 text-[0.8125rem] leading-snug text-text-2">Get ₹201 in demo money after each friend&apos;s first payment</p>
            </div>
            <Button variant="outlined" size="sm" onClick={invite}>
              Invite
            </Button>
          </section>
        </div>
      </div>

      <Link
        href="/explore"
        tabIndex={fabVisible ? 0 : -1}
        className={`press absolute bottom-5 left-1/2 z-10 flex h-12 -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary pl-4 pr-5 text-[0.9375rem] font-medium text-white transition-[opacity,transform] duration-200 ${
          fabVisible ? "opacity-100" : "pointer-events-none translate-y-6 opacity-0"
        }`}
      >
        <Icon name="add" size={22} />
        New payment
      </Link>
    </div>
  );
}

function SectionHeader({ id, title, action }: { id: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className="text-[1.0625rem] font-medium">
        {title}
      </h2>
      {action}
    </div>
  );
}

/** A 4-up grid tile: avatar on top, one line of label under it. */
function GridTile({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="press flex min-w-0 flex-col items-center gap-2 rounded-xl py-1.5">
      {children}
      <span className="w-full truncate px-0.5 text-center text-[0.8125rem] text-text">{label}</span>
    </Link>
  );
}

function PeopleSection() {
  const people = useRecentPeople();
  const hydrated = useHydrated();
  return (
    <section aria-labelledby="people">
      <SectionHeader id="people" title="People" />
      <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4 @2xl:grid-cols-8">
        {people.slice(0, 7).map((c) => (
          <li key={c.id} className="min-w-0">
            <GridTile href={`/chat/${c.id}`} label={c.name}>
              {hydrated ? <ContactAvatar contact={c} size={52} /> : <span className="skeleton size-[3.25rem] rounded-[0.9375rem]" />}
            </GridTile>
          </li>
        ))}
        <li className="min-w-0">
          <GridTile href="/explore" label="More">
            <span className="grid size-[3.25rem] place-items-center rounded-[0.9375rem] border border-dashed border-line-strong text-text-2">
              <Icon name="keyboard_arrow_down" size={24} />
            </span>
          </GridTile>
        </li>
      </ul>
    </section>
  );
}

function BusinessSection() {
  const businesses = useBusinesses();
  return (
    <section aria-labelledby="biz" className="mt-9">
      <SectionHeader
        id="biz"
        title="Businesses & bills"
        action={
          <Link href="/explore?tab=businesses" className="press flex h-8 shrink-0 items-center gap-1.5 rounded-[0.5625rem] bg-primary-soft px-3 text-[0.8125rem] font-medium text-primary-fg">
            <Icon name="shopping_bag" size={16} />
            Explore
          </Link>
        }
      />
      {/* Wraps instead of scrolling, so no chip is ever cut off at the screen edge. */}
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Shortcuts">
        {CHIPS.map((c) => (
          <li key={c.href}>
            <Link href={c.href} className="press flex h-8 items-center gap-1.5 rounded-[0.5625rem] border border-button-line bg-button px-2.5 text-[0.8125rem] text-text shadow-e1">
              <Icon name={c.icon} size={16} className="text-text-2" />
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="mt-5 grid grid-cols-4 gap-x-2 gap-y-4 @2xl:grid-cols-8">
        {businesses.map((b) => (
          <li key={b.id} className="min-w-0">
            <GridTile href={`/chat/${b.id}`} label={b.name}>
              <ContactAvatar contact={b} size={52} />
            </GridTile>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PromotionsSection() {
  const fresh = useStore((s) => s.rewards.filter((r) => !r.scratched).length);
  const items: { href: string; label: string; icon: IconName; badge?: number }[] = [
    { href: "/rewards", label: "Rewards", icon: "trophy", badge: fresh },
    { href: "/offers", label: "Offers", icon: "sell" },
    { href: "/referrals", label: "Referrals", icon: "group_add" },
    { href: "/add-money", label: "Add money", icon: "add_circle" },
  ];
  return (
    <section aria-labelledby="promos" className="mt-9">
      <SectionHeader id="promos" title="Promotions" />
      <ul className="mt-4 grid grid-cols-4 gap-x-2">
        {items.map((p) => (
          <li key={p.href} className="min-w-0">
            <GridTile href={p.href} label={p.label}>
              <span className="relative">
                <Avatar name={p.label} icon={p.icon} size={52} />
                {!!p.badge && (
                  <span className="money absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-md bg-danger px-1 text-[0.6875rem] font-medium text-white">{p.badge}</span>
                )}
              </span>
            </GridTile>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AccountSection() {
  const rows: { href: string; label: string; icon: IconName }[] = [
    { href: "/transactions", label: "See all payment activity", icon: "av_timer" },
    { href: "/balance", label: "Check account balance", icon: "account_balance" },
    { href: "/my-code?tab=qr", label: "Show my QR code", icon: "qr_code_2" },
  ];
  return (
    <nav aria-label="Account" className="mt-9 overflow-hidden rounded-2xl bg-surface-2">
      {rows.map((r) => (
        <Link key={r.href} href={r.href} className="press flex h-[3.625rem] items-center gap-3.5 border-b border-line px-4 text-[0.9375rem] last:border-0">
          <Icon name={r.icon} size={21} className="text-text-2" />
          <span className="min-w-0 flex-1 truncate">{r.label}</span>
          <Icon name="chevron_right" size={20} className="text-text-3" />
        </Link>
      ))}
    </nav>
  );
}

function ActivitySection() {
  const transactions = useStore((s) => s.transactions);
  const hydrated = useHydrated();
  const recent = useMemo(() => [...transactions].sort((a, b) => b.at - a.at).slice(0, 3), [transactions]);
  if (!hydrated || recent.length === 0) return null;
  return (
    <section aria-labelledby="recent" className="mt-9">
      <SectionHeader
        id="recent"
        title="Recent activity"
        action={
          <Link href="/transactions" className="press shrink-0 rounded-md px-1 text-[0.8125rem] font-medium text-primary-fg">
            See all
          </Link>
        }
      />
      <ul className="mt-3 divide-y divide-line">
        {recent.map((t) => (
          <ActivityRow key={t.id} tx={t} />
        ))}
      </ul>
    </section>
  );
}

function ActivityRow({ tx }: { tx: Transaction }) {
  const credit = tx.direction === "credit";
  const day = formatDay(tx.at);
  return (
    <li>
      <Link href={`/receipt/${tx.id}`} className="flex items-center gap-3 py-3.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem]">{tx.counterpartyName}</span>
          <span className="block text-[0.8125rem] text-text-3">{day === "Today" ? formatTime(tx.at) : day}</span>
        </span>
        <span className={`money shrink-0 text-[0.9375rem] ${credit ? "text-success" : "text-text"}`}>{formatMoney(credit ? tx.amount : -tx.amount, { sign: true }).replace(" ", "")}</span>
      </Link>
    </li>
  );
}
