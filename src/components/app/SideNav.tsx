"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { totalBalance } from "@/lib/actions";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import { ThemeToggle } from "./ThemeToggle";

const MAIN: { href: string; label: string; icon: IconName; also?: string[] }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/explore", label: "Pay people", icon: "group", also: ["/chat", "/pay", "/request", "/phone", "/bank-transfer", "/self-transfer"] },
  { href: "/scan", label: "Scan QR", icon: "qr_code_scanner", also: ["/my-code"] },
  { href: "/add-money", label: "Add money", icon: "add_circle" },
  { href: "/bills", label: "Bills", icon: "receipt_long" },
  { href: "/recharge", label: "Recharge", icon: "mobile" },
  { href: "/transactions", label: "Transactions", icon: "history", also: ["/receipt", "/balance"] },
  { href: "/rewards", label: "Rewards", icon: "trophy", also: ["/offers", "/referrals"] },
];

const MORE: { href: string; label: string; icon: IconName; also?: string[] }[] = [
  { href: "/tpi", label: "TPI network", icon: "hub" },
  { href: "/settings", label: "Settings", icon: "settings", also: ["/payment-methods"] },
  { href: "/help", label: "Help", icon: "help" },
];

function isActive(pathname: string, item: { href: string; also?: string[] }) {
  const prefixes = item.href === "/" ? [] : [item.href, ...(item.also ?? [])];
  return pathname === item.href || prefixes.some((p) => pathname.startsWith(`${p}/`) || pathname === p);
}

/**
 * Laptop navigation, left of the app column: an icon rail from 640px, a labelled sidebar from 1024px.
 * Hidden on phones, where the app's own screens handle navigation.
 */
export function SideNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const signedIn = useStore((s) => s.onboarded) && hydrated;
  const profile = useStore((s) => s.profile);
  const balance = useStore(totalBalance);

  return (
    <nav aria-label="Main" className="side-nav no-scrollbar h-dvh w-[4.5rem] shrink-0 flex-col overflow-y-auto overflow-x-hidden px-2 py-4 lg:w-[15.5rem] lg:px-3">
      <Link href="/" className="press flex items-center gap-2.5 rounded-xl px-2.5 py-2">
        <LogoMark size={26} />
        <Wordmark className="hidden text-lg lg:inline" />
      </Link>
      <span className="mx-2.5 mt-2 hidden lg:block">
        <DemoBadge />
      </span>

      {signedIn && (
        <>
          <ul className="mt-5 space-y-0.5">
            {MAIN.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(pathname, item)} />
            ))}
          </ul>
          <div className="mx-2.5 my-3 border-t border-line" />
          <ul className="space-y-0.5">
            {MORE.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(pathname, item)} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <ThemeToggle className="mx-auto lg:mx-1" />
        {signedIn && (
          <Link
            href="/profile"
            aria-label={`Profile: ${profile.name}`}
            className={`press flex items-center gap-3 rounded-xl p-2 ${pathname === "/profile" ? "bg-surface-2" : ""}`}
          >
            <Avatar name={profile.name || "You"} color="#1f6ff2" size={38} className="!rounded-full" />
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-sm font-medium">{profile.name}</span>
              <span className="block truncate text-xs text-text-2">{profile.handle}</span>
              <span className="money block text-xs text-text-2">{formatMoney(balance)}</span>
            </span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function NavItem({ href, label, icon, active }: { href: string; label: string; icon: IconName; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        title={label}
        aria-current={active ? "page" : undefined}
        className={`press flex h-11 items-center justify-center gap-3 rounded-xl px-2.5 text-[0.9375rem] lg:justify-start ${
          active ? "bg-surface-2 font-medium text-text dark:bg-surface-3" : "text-text-2 hover:bg-surface-2 hover:text-text"
        }`}
      >
        <Icon name={icon} size={22} filled={active} />
        <span className="hidden truncate lg:inline">{label}</span>
      </Link>
    </li>
  );
}
