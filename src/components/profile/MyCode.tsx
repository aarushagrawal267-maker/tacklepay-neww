"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { DottedRing } from "@/components/ui/DottedRing";
import { Icon } from "@/components/ui/Icon";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { QrCode } from "@/components/ui/QrCode";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/toast";
import { useBack } from "@/components/ui/TopBar";
import { CURRENCY_SYMBOL, formatMoney, MAX_PAYMENT_PAISE, parseAmount } from "@/lib/money";
import { buildPayLink } from "@/lib/qr";
import { useHydrated, useStore } from "@/lib/store";

const noop = () => () => {};

/** Two swipeable pages, as in the reference ProfileDetailsScreen: your profile, then your payment QR. */
export function MyCode() {
  const params = useSearchParams();
  const router = useRouter();
  const back = useBack("/profile");
  const hydrated = useHydrated();
  const profile = useStore((s) => s.profile);
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const pager = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(params.get("tab") === "qr" ? 1 : 0);
  const [amount, setAmount] = useState<number>();
  const [askAmount, setAskAmount] = useState(false);

  useEffect(() => {
    const el = pager.current;
    if (!el) return;
    if (params.get("tab") === "qr") el.scrollLeft = el.clientWidth;
    const onScroll = () => setPage(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [params, hydrated]);

  if (!hydrated) return <ScreenSkeleton />;

  const link = origin ? buildPayLink(origin, { handle: profile.handle, name: profile.name, amountPaise: amount }) : "";
  const goTo = (i: number) => pager.current?.scrollTo({ left: i * pager.current.clientWidth, behavior: "smooth" });

  const share = async (kind: "profile" | "qr") => {
    const text =
      kind === "qr"
        ? `Pay me ${amount ? formatMoney(amount) + " " : ""}on TacketPay (demo money only): ${link}`
        : `Find me on TacketPay — ${profile.name} (${profile.handle}). Demo money only. ${link}`;
    try {
      if (navigator.share) await navigator.share({ title: "TacketPay", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Link copied");
      }
    } catch {
      // Dismissed.
    }
  };

  return (
    <div className="animate-fade flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center border-b border-line px-1">
        <IconButton icon="close" label="Close" onClick={back} />
        <div className="flex flex-1 justify-center gap-2" role="tablist" aria-label="Pages">
          {["Profile", "QR code"].map((label, i) => (
            <button
              key={label}
              role="tab"
              aria-selected={page === i}
              aria-label={label}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-colors duration-200 ${page === i ? "w-5 bg-text" : "w-1.5 bg-line-strong"}`}
            />
          ))}
        </div>
        <OverflowMenu items={[{ label: "Send feedback" }]} />
      </header>

      <div ref={pager} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto">
        <section className="flex w-full shrink-0 snap-start flex-col items-center justify-center overflow-y-auto px-8 pb-6 text-center" aria-label="Profile">
          <DottedRing size={260}>
            <Avatar name={profile.name} size={104} className="!rounded-full" />
          </DottedRing>
          <h1 className="mt-5 text-[1.375rem]">{profile.name}</h1>
          <p className="mt-2 text-sm text-text-2">Friends can scan your QR code to pay you demo money</p>
          <div className="mt-10 flex w-full max-w-[16.25rem] flex-col gap-3">
            <Button icon="share" onClick={() => share("profile")}>
              Share profile link
            </Button>
            <Button variant="outlined" icon="qr_code_scanner" onClick={() => router.push("/scan")}>
              Open scanner
            </Button>
          </div>
        </section>

        <section className="flex w-full shrink-0 snap-start flex-col items-center justify-center overflow-y-auto px-8 pb-6 text-center" aria-label="My QR code">
          <div className="rounded-3xl border border-line bg-surface-2 p-2">
            {link ? <QrCode value={link} size={208} label={`QR code to pay ${profile.name}`} /> : <div className="skeleton size-64 rounded-2xl" />}
          </div>
          <p className="mt-4 text-xs text-text-2">{profile.handle}</p>
          <h1 className="mt-5 text-lg font-medium">{profile.name}</h1>
          {profile.phone && <p className="text-[0.8125rem]">{profile.phone}</p>}
          {amount ? (
            <p className="mt-3 flex items-center gap-2 rounded-[0.625rem] bg-primary-soft py-1 pl-3 pr-1 text-sm text-primary-fg">
              Requesting {formatMoney(amount)}
              <button type="button" aria-label="Remove amount" onClick={() => setAmount(undefined)} className="press grid size-7 place-items-center rounded-full">
                <Icon name="close" size={18} />
              </button>
            </p>
          ) : (
            <p className="mt-3 text-sm">Scan my code to pay</p>
          )}
          <DemoBadge className="mt-3" />
          <div className="mt-6 flex w-full max-w-[18.75rem] gap-3">
            <Button variant="outlined" className="flex-1" icon="currency_rupee" onClick={() => setAskAmount(true)}>
              {amount ? "Change" : "Amount"}
            </Button>
            <Button className="flex-1" icon="share" onClick={() => share("qr")}>
              Share
            </Button>
          </div>
        </section>
      </div>

      <AmountSheet
        open={askAmount}
        onClose={() => setAskAmount(false)}
        onSave={(v) => {
          setAmount(v);
          setAskAmount(false);
          goTo(1);
        }}
      />
    </div>
  );
}

function AmountSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (paise: number) => void }) {
  const [text, setText] = useState("");
  const paise = parseAmount(text);
  const error = text && (!paise ? "Enter a valid amount" : paise > MAX_PAYMENT_PAISE ? "Demo requests are limited to ₹1,00,000" : undefined);
  return (
    <Sheet open={open} onClose={onClose} title="Request a specific amount">
      <form
        className="px-6 pb-2 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (paise && !error) {
            onSave(paise);
            setText("");
          }
        }}
      >
        <label className="flex h-16 items-center gap-1 rounded-2xl border-2 border-primary-fg px-4 text-3xl font-medium">
          <span>{CURRENCY_SYMBOL}</span>
          <input
            data-autofocus
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
            aria-label="Amount in rupees"
            className="money min-w-0 flex-1 bg-transparent outline-none"
            placeholder="0"
          />
        </label>
        <p role="alert" className="mt-2 min-h-5 text-sm text-danger">
          {error}
        </p>
        <p className="text-sm text-text-2">The amount is added to your QR code. Whoever scans it can still change it before paying.</p>
        <Button type="submit" block size="lg" className="mt-5" disabled={!paise || !!error}>
          Update QR code
        </Button>
      </form>
    </Sheet>
  );
}
