"use client";
import Link from "next/link";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Stat } from "@/components/ui/Card";
import { Badge, DemoBadge } from "@/components/ui/DemoBadge";
import { DottedRing } from "@/components/ui/DottedRing";
import { Icon, type IconName } from "@/components/ui/Icon";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { toast } from "@/components/ui/toast";
import { useBack } from "@/components/ui/TopBar";
import { primaryAccount } from "@/lib/actions";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

export function Profile() {
  const router = useRouter();
  const back = useBack("/");
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const code = useStore((s) => s.referralCode);
  const rewards = useStore((s) => s.rewards);
  const accounts = useStore((s) => s.accounts);
  const earned = useMemo(() => rewards.reduce((sum, r) => sum + (r.scratched && r.amount ? r.amount : 0), 0), [rewards]);

  if (!hydrated) return <ScreenSkeleton />;
  const account = primaryAccount({ accounts });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast(`${code} copied to clipboard`);
    } catch {
      toast("Couldn't copy");
    }
  };

  const invite = async () => {
    const text = `Join me on TacketPay (demo money only). Use my code ${code}.`;
    try {
      if (navigator.share) await navigator.share({ title: "TacketPay", text, url: window.location.origin });
      else await copy();
    } catch {
      // Dismissed.
    }
  };

  return (
    <div className="animate-fade flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-1 text-text">
        <IconButton icon="arrow_back" label="Back" onClick={back} />
        <DemoBadge />
        <div className="flex items-center">
          <ThemeToggle />
          <OverflowMenu items={[{ label: "Referral code", onSelect: () => router.push("/referrals") }, { label: "Send feedback" }]} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
        <section className="flex items-center gap-4 rounded-2xl border border-line p-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-medium">{profile.name}</h1>
            {profile.phone && <p className="money mt-0.5 text-[0.875rem] text-text-2">{profile.phone}</p>}
            <p className="truncate text-[0.875rem] text-text-2">{profile.handle}</p>
          </div>
          <Link href="/my-code" aria-label="Show my QR code" className="press shrink-0 rounded-full">
            <DottedRing size={104}>
              <Avatar name={profile.name} color="#1f6ff2" size={60} className="!rounded-full" />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-lg bg-text text-bg ring-2 ring-[var(--bg)]">
                <Icon name="qr_code_2" size={16} />
              </span>
            </DottedRing>
          </Link>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Rewards earned" value={formatMoney(earned)} tone="success" hint="From scratch cards" href="/rewards" />
          <Stat label="Referral code" value={code} hint="Tap Invite to share" />
        </div>

        <section className="mt-3 rounded-2xl bg-surface-2">
          <h2 className="px-4 pt-4 text-[0.8125rem] font-medium text-text-3">Bank account and cards</h2>
          <Link href="/payment-methods" className="press flex items-center gap-3 px-4 py-3">
            <span className="grid size-10 place-items-center rounded-[0.625rem] bg-surface text-text-2 dark:bg-surface-3">
              <Icon name="account_balance" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-medium">
                {account ? `${account.bank} •••• ${account.last4}` : "Demo bank account"}
              </span>
              <Badge tone="success" className="mt-1">
                Default bank account
              </Badge>
            </span>
            <Icon name="chevron_right" className="text-text-3" />
          </Link>
        </section>

        <section className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-2 p-5">
          <span className="grid size-10 place-items-center rounded-[0.625rem] bg-surface text-text-2 dark:bg-surface-3">
            <Icon name="redeem" size={22} />
          </span>
          <button type="button" onClick={copy} className="min-w-0 flex-1 text-left">
            <span className="block text-[0.9375rem] font-medium">Invite and earn</span>
            <span className="mt-0.5 flex items-center gap-1 text-[0.8125rem] text-text-2">
              Share code <span className="money font-medium text-text">{code}</span>
              <Icon name="content_copy" size={14} />
            </span>
          </button>
          <Button variant="outlined" size="sm" icon="send" onClick={invite}>
            Invite
          </Button>
        </section>

        <nav className="mt-3 overflow-hidden rounded-2xl bg-surface-2" aria-label="More">
          <ProfileRow href="/settings" icon="settings" label="Settings" />
          <ProfileRow href="/transactions" icon="history" label="Payment activity" />
          <ProfileRow href="/add-money" icon="add_circle" label="Add money" />
          <ProfileRow href="/help" icon="help" label="Help and feedback" />
        </nav>
      </main>

      <button
        type="button"
        onClick={back}
        aria-label="Close profile"
        className="grid h-12 shrink-0 place-items-center border-t border-line text-text-3"
      >
        <Icon name="keyboard_arrow_up" size={36} />
      </button>
    </div>
  );
}

function ProfileRow({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className="press flex h-14 items-center gap-3 border-b border-line px-4 last:border-0">
      <Icon name={icon} className="text-text-2" size={22} />
      <span className="flex-1 text-[0.9375rem]">{label}</span>
      <Icon name="chevron_right" className="text-text-3" />
    </Link>
  );
}
