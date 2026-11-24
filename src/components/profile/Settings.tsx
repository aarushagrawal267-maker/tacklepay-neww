"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ListRow, SectionLabel } from "@/components/ui/ListRow";
import { Screen, ScreenSkeleton, ScrollBody } from "@/components/ui/Screen";
import { Dialog, Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { setTheme } from "@/lib/actions";
import { errorText, tpiApi } from "@/lib/api";
import { setState, useHydrated, useStore } from "@/lib/store";
import type { ThemePref } from "@/lib/types";

const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function Settings() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const theme = useStore((s) => s.theme);
  const [sheet, setSheet] = useState<"theme" | "name" | "about" | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [name, setName] = useState("");

  if (!hydrated) return <ScreenSkeleton />;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(profile.handle);
      toast(`${profile.handle} copied to clipboard`);
    } catch {
      toast("Couldn't copy");
    }
  };

  return (
    <Screen>
      <TopBar nav="close" title="Settings" />
      <ScrollBody className="pb-10">
        <section className="flex flex-col items-center px-5 pb-4 pt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setName(profile.name);
              setSheet("name");
            }}
            className="press relative rounded-full"
            aria-label="Edit name"
          >
            <Avatar name={profile.name} color="#1f6ff2" size={72} />
            <span className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-lg border border-line bg-surface text-text-2">
              <Icon name="edit" size={16} />
            </span>
          </button>
          <h1 className="mt-3 text-xl">{profile.name}</h1>
          {profile.phone && <p className="text-sm text-text-2">{profile.phone}</p>}
          <button type="button" onClick={copyId} className="press mt-1 flex items-center gap-1 rounded-lg px-3 py-1 text-sm text-text-2">
            TacketPay ID: <span className="text-text">{profile.handle}</span>
            <Icon name="content_copy" size={16} />
          </button>
        </section>

        <SectionLabel>Account</SectionLabel>
        <p className="px-5 pb-2 text-[0.8125rem] text-text-2">Signed in as {profile.handle} · demo account on TPI</p>
        <ListRow icon="call" label="Phone number" detail={profile.phone || "Not added"} onClick={() => toast("You sign in with this number. It's never verified in the demo")} />
        <ListRow icon="account_balance" label="Payment methods" href="/payment-methods" />
        <ListRow icon="language" label="Language" detail="English" onClick={() => toast("More languages are coming to the demo")} />
        <ListRow icon="dark_mode" label="Theme" detail={THEMES.find((t) => t.value === theme)?.label} onClick={() => setSheet("theme")} />

        <SectionLabel>Privacy and security</SectionLabel>
        <ListRow icon="notifications" label="Notifications" detail="Payment alerts appear in the app only" onClick={() => toast("Notifications are off in the demo")} />
        <ListRow icon="shield" label="Security" detail="Demo PIN set when you joined · locks after 5 wrong tries" onClick={() => toast("There's nothing real to protect — it's all demo money")} />
        <ListRow icon="logout" label="Sign out" detail="Your balance and history stay saved on TPI" onClick={() => setConfirmSignOut(true)} danger />

        <SectionLabel>Information</SectionLabel>
        <ListRow icon="hub" label="TPI network" detail="Live payments, ledgers and settlement positions" href="/tpi" />
        <ListRow icon="help" label="Help and feedback" href="/help" />
        <ListRow icon="report" label="Raise a dispute" detail="Demo payments can't be disputed" onClick={() => toast("Demo payments can't be disputed")} />
        <ListRow icon="info" label="About TacketPay" detail="Version 1.0 · demo build" onClick={() => setSheet("about")} />
      </ScrollBody>

      <Sheet open={sheet === "theme"} onClose={() => setSheet(null)} title="Choose theme">
        <div role="radiogroup" aria-label="Theme" className="py-2">
          {THEMES.map((t) => (
            <label key={t.value} className="press flex h-14 cursor-pointer items-center gap-4 px-6">
              <input
                type="radio"
                name="theme"
                checked={theme === t.value}
                onChange={() => {
                  setState((s) => setTheme(s, t.value));
                  setSheet(null);
                }}
                className="size-5 accent-[var(--primary)]"
              />
              <span className="text-[0.9375rem]">{t.label}</span>
            </label>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "name"} onClose={() => setSheet(null)} title="Edit name">
        <form
          className="px-6 pb-2 pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            try {
              await tpiApi.rename(name);
              setSheet(null);
              toast("Name updated");
            } catch (err) {
              toast(errorText(err));
            }
          }}
        >
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} data-autofocus error={!name.trim() ? "Name can't be empty" : undefined} />
          <p className="mt-3 text-xs text-text-2">Your TacketPay ID stays {profile.handle}, so existing QR codes keep working.</p>
          <Button type="submit" block className="mt-5" disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </Sheet>

      <Sheet open={sheet === "about"} onClose={() => setSheet(null)} title="About TacketPay">
        <div className="space-y-3 px-6 pb-4 pt-3 text-sm leading-relaxed text-text-2">
          <p>TacketPay is a design demo of a mobile payments app. Every balance, payment, reward and receipt uses demo money that has no value.</p>
          <p>
            Payments run over TPI, a UPI-style network for demo money: a switch that validates the payee, debits the payer, credits the payee and reverses the debit if
            the credit fails. Balances and history are kept on the TacketPay server, so they&apos;re still there when you come back or sign in on another phone.
          </p>
          <p>No real bank, card or UPI network is connected.</p>
          <p>Interface adapted from the open-source GpayApp-Flutter project (MIT). Icons: Material Symbols (Apache 2.0). Not affiliated with Google Pay or NPCI.</p>
        </div>
      </Sheet>

      <Dialog
        open={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title="Sign out?"
        actions={
          <>
            <Button variant="text" onClick={() => setConfirmSignOut(false)} data-autofocus>
              Cancel
            </Button>
            <Button
              variant="text"
              className="!text-danger"
              onClick={async () => {
                setConfirmSignOut(false);
                await tpiApi.signOut();
                router.replace("/welcome");
              }}
            >
              Sign out
            </Button>
          </>
        }
      >
        Nothing is lost: your demo balance, chats and history stay on TPI. Sign back in with {profile.phone || "your number"} and your demo PIN.
      </Dialog>
    </Screen>
  );
}
