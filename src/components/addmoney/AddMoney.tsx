"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PinScreen } from "@/components/pay/PinScreen";
import { SuccessMark } from "@/components/receipt/SuccessMark";
import { Avatar } from "@/components/ui/Avatar";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Keypad } from "@/components/ui/Keypad";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { useBack } from "@/components/ui/TopBar";
import { ERROR_COPY, totalBalance } from "@/lib/actions";
import { ApiError, errorText, tpiApi } from "@/lib/api";
import { useRecentPeople } from "@/lib/hooks";
import { CURRENCY_SYMBOL, groupTyped, formatMoney, MAX_PAYMENT_PAISE, parseAmount, pressAmountKey } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import { CoinStack } from "./Coin";
import { CoinCarousel, CoinCluster } from "./CoinCarousel";

type Step = "menu" | "bank" | "amount" | "pin" | "done" | "friend";

const QUICK = [500, 1000, 2000, 5000];

const FRIEND_SLIDES = [
  {
    title: ["Get paid by friends.", "In demo rupees."],
    body: "Show your TacketPay QR, or share your TPI ID. Friends on TacketPay can pay you from their phone.",
    groups: [["in", "inr", "tacket"], ["usd", "eur"]] as const,
  },
  {
    title: ["Their balance goes down.", "Yours goes up."],
    body: "TPI moves the money the moment they enter their PIN. It shows up in your balance and history on its own — nothing to scan.",
    groups: [["tacket", "inr"], ["gbp", "yen", "in"]] as const,
  },
];

/**
 * "Add money" sheet modelled on the Plasma reference: a spinning coin carousel over two
 * option cards, each opening a detail step with a coin cluster, numbered steps and a pill button.
 */
export function AddMoney() {
  const router = useRouter();
  const back = useBack("/");
  const hydrated = useHydrated();
  const balance = useStore(totalBalance);
  const accounts = useStore((s) => s.accounts);
  const people = useRecentPeople();
  const myName = useStore((s) => s.profile.name);
  const [step, setStep] = useState<Step>("menu");
  const [slide, setSlide] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pinError, setPinError] = useState<string>();
  const [added, setAdded] = useState(0);
  const account = accounts.find((a) => a.primary) ?? accounts[0];
  const amount = parseAmount(text) ?? 0;

  // Hidden routes stay mounted: start from the menu on every visit.
  const reset = useCallback(() => {
    setStep("menu");
    setSlide(0);
    setText("");
    setError(undefined);
  }, []);
  const close = useCallback(() => {
    back();
    window.setTimeout(reset, 300);
  }, [back, reset]);

  const review = useCallback(() => {
    if (amount <= 0) return setError(ERROR_COPY.INVALID_AMOUNT);
    if (amount > MAX_PAYMENT_PAISE) return setError("You can add up to ₹1,00,000 at a time");
    setError(undefined);
    setPinError(undefined);
    setStep("pin");
  }, [amount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "pin") close();
      // Typed amounts for laptops, where the on-screen keypad is hidden.
      if (step !== "amount" || (e.target as HTMLElement).tagName === "INPUT") return;
      if (/^[\d.]$/.test(e.key) || e.key === "Backspace") {
        setText((t) => pressAmountKey(t, e.key === "Backspace" ? "back" : e.key));
        setError(undefined);
      } else if (e.key === "Enter") review();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, step, review]);

  const confirm = useCallback(
    async (pin: string) => {
      try {
        await tpiApi.topUp({ amount, accountId: account?.id, pin });
      } catch (err) {
        if (err instanceof ApiError && err.code === "PIN_INVALID") return setPinError(errorText(err));
        setError(errorText(err));
        setStep("amount");
        return;
      }
      setAdded(amount);
      setText("");
      setStep("done");
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    },
    [amount, account],
  );

  if (!hydrated) return <ScreenSkeleton />;

  const toAmount = () => {
    setError(undefined);
    setStep("amount");
  };
  const hasBack = step !== "menu" && step !== "done";
  const goBack = () => setStep(step === "amount" ? "bank" : "menu");

  return (
    <div className="animate-fade relative flex h-full flex-col bg-surface-3 dark:bg-[#0a0a0a]">
      {/* Backdrop: the balance the sheet will add to, like "Spendable $0.00". */}
      <div className="flex shrink-0 flex-col items-center px-4 pb-10 pt-4">
        <div className="flex w-full">
          <Avatar name={myName || "You"} size={34} className="!rounded-full !bg-surface" />
        </div>
        <p className="mt-2 text-[0.9375rem] text-text-2">Spendable</p>
        <p className="money text-[2.125rem] font-medium leading-tight">{formatMoney(balance)}</p>
        <DemoBadge className="mt-1.5" />
      </div>

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Add money"
        className="animate-sheet relative -mt-4 flex min-h-0 flex-1 flex-col rounded-t-[1.75rem] bg-surface shadow-[0_-8px_30px_rgb(0_0_0/0.08)] dark:border-t dark:border-line"
      >
        <div className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
        <div className="flex shrink-0 items-center justify-between px-4 pt-1">
          {hasBack ? <RoundButton icon="chevron_left" label="Back" onClick={goBack} /> : <span className="size-10" />}
          {step === "amount" && <span className="text-[0.9375rem] font-medium">Add from bank</span>}
          {step === "friend" && <span className="text-[0.9375rem] font-medium">Receive from a friend</span>}
          <RoundButton icon="close" label="Close" onClick={close} />
        </div>

        <div key={step === "friend" ? `friend-${slide}` : step} className="animate-fade flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          {step === "menu" && (
            <>
              <div className="pt-3">
                <CoinCarousel />
              </div>
              <h1 className="mt-6 text-center text-[1.375rem] font-medium tracking-tight">Add money</h1>
              <p className="mt-1 text-center text-[0.9375rem] text-text-2">Choose how to add demo money to your account.</p>
              <div className="mt-6 space-y-2.5">
                <OptionCard title="Add from bank" subtitle="From a linked demo bank account" onClick={() => setStep("bank")}>
                  <CoinStack kinds={["bank", "inr", "in"]} more={accounts.length + 1} />
                </OptionCard>
                <OptionCard title="Receive from a friend" subtitle="They pay your QR code or TPI ID" onClick={() => setStep("friend")}>
                  <span className="mt-2 flex items-center">
                    {people.slice(0, 3).map((p, i) => (
                      <span key={p.id} className="-ml-1.5 rounded-full ring-2 ring-[var(--surface-2)] first:ml-0" style={{ zIndex: 3 - i }}>
                        <Avatar name={p.name} size={24} className="!rounded-full" />
                      </span>
                    ))}
                    <span className="money ml-1.5 text-[0.8125rem] text-text-2">+{Math.max(0, people.length - 3)}</span>
                  </span>
                </OptionCard>
              </div>
              <p className="mt-auto pt-6 text-center text-xs text-text-3">Everything here is play money. No bank is ever charged.</p>
            </>
          )}

          {step === "bank" && (
            <>
              <div className="pt-6">
                <CoinCluster groups={[["inr", "in", "bank"], ["tacket", "usd"]]} />
              </div>
              <h1 className="mt-7 text-center text-[1.375rem] font-medium tracking-tight">Add money from your bank</h1>
              <p className="mx-auto mt-1.5 max-w-[18.75rem] text-center text-[0.9375rem] text-text-2">
                Top up your TacketPay balance from {account ? `${account.bank} ${account.last4}` : "your demo bank"}.
              </p>
              <ol className="mt-6 divide-y divide-line rounded-2xl bg-surface-2">
                <StepRow n={1} title="Pick an amount" body="Up to ₹1,00,000 at a time and ₹2,00,000 a day, straight into your balance." />
                <StepRow n={2} title="Confirm with your demo PIN" body="The PIN you chose when you joined. It's a demo bank, so nothing real is charged." />
              </ol>
              <p className="mt-auto pt-6 text-center text-[0.8125rem] text-text-2">Demo money arrives instantly</p>
              <PillButton onClick={toAmount}>Continue</PillButton>
            </>
          )}

          {step === "amount" && (
            <>
              <div className="flex flex-col items-center pt-4">
                <output aria-live="polite" aria-label="Amount to add" className={`money font-medium leading-none ${text.length > 6 ? "text-[2.375rem]" : "text-[2.875rem]"}`}>
                  {CURRENCY_SYMBOL}
                  {groupTyped(text) || <span className="text-text-3">0</span>}
                </output>
                <p className="mt-2 text-[0.8125rem] text-text-2">
                  To {account?.bank} {account?.last4} · balance <span className="money">{formatMoney(account?.balance ?? 0)}</span>
                </p>
                <p role="alert" className="mt-1 min-h-5 text-sm text-danger">
                  {error}
                </p>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setText(String(q));
                      setError(undefined);
                    }}
                    className={`press money h-10 rounded-[0.625rem] border text-sm ${text === String(q) ? "border-primary-fg bg-primary-soft text-primary-fg" : "border-button-line bg-button shadow-e1"}`}
                  >
                    +{formatMoney(q * 100)}
                  </button>
                ))}
              </div>
              <div className="-mx-5 mt-1">
                <Keypad
                  onKey={(k) => {
                    setText((t) => pressAmountKey(t, k));
                    setError(undefined);
                  }}
                />
              </div>
              <p className="mb-2 mt-4 hidden text-center text-xs text-text-3 sm:pointer-fine:block">Type the amount on your keyboard · Enter to continue</p>
              <PillButton onClick={review} disabled={amount <= 0}>
                {amount > 0 ? `Add ${formatMoney(amount)}` : "Enter an amount"}
              </PillButton>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-1 flex-col items-center pt-8 text-center">
              <span className="text-success">
                <SuccessMark animate />
              </span>
              <p className="mt-5 text-[0.9375rem] text-text-2">Added to your balance</p>
              <p className="money text-[2.5rem] font-medium leading-tight text-success">+{formatMoney(added)}</p>
              <p className="mt-1 text-[0.8125rem] text-text-3">
                New balance <span className="money">{formatMoney(balance)}</span>
              </p>
              <DemoBadge className="mt-4" />
              <div className="mt-auto flex w-full flex-col gap-3 pt-8">
                <PillButton onClick={close}>Done</PillButton>
                <button type="button" onClick={toAmount} className="press h-12 rounded-full text-[0.9375rem] font-medium text-text-2">
                  Add more
                </button>
              </div>
            </div>
          )}

          {step === "friend" && (
            <>
              <div className="pt-8">
                <CoinCluster groups={FRIEND_SLIDES[slide].groups.map((g) => [...g])} />
              </div>
              <h1 className="mt-8 text-center text-[1.375rem] font-medium leading-snug tracking-tight">
                {FRIEND_SLIDES[slide].title[0]}
                <br />
                {FRIEND_SLIDES[slide].title[1]}
              </h1>
              <p className="mx-auto mt-2 max-w-[19.375rem] text-center text-[0.9375rem] text-text-2">{FRIEND_SLIDES[slide].body}</p>
              <div className="mt-5 flex justify-center gap-1.5" role="tablist" aria-label="Slides">
                {FRIEND_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={slide === i}
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setSlide(i)}
                    className={`h-1.5 rounded-full transition-colors duration-200 ${slide === i ? "w-4 bg-text" : "w-1.5 bg-line-strong"}`}
                  />
                ))}
              </div>
              <div className="mt-auto flex flex-col gap-3 pt-6">
                {slide < FRIEND_SLIDES.length - 1 ? (
                  <PillButton onClick={() => setSlide(slide + 1)}>Next</PillButton>
                ) : (
                  <>
                    <PillButton onClick={() => router.push("/my-code?tab=qr")}>Show my QR code</PillButton>
                    <button type="button" onClick={() => router.push("/transactions")} className="press h-12 rounded-full text-[0.9375rem] font-medium text-text-2">
                      See what&apos;s arrived
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {step === "pin" && (
        <PinScreen
          bank={account ? `${account.bank} ${account.last4}` : "Demo bank"}
          amount={amount}
          payee="your balance"
          error={pinError}
          onDone={confirm}
          onCancel={() => setStep("amount")}
        />
      )}
    </div>
  );
}

function RoundButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="press grid size-10 place-items-center rounded-full bg-surface-2 text-text dark:bg-surface-3">
      <Icon name={icon} size={22} />
    </button>
  );
}

function OptionCard({ title, subtitle, onClick, children }: { title: string; subtitle: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-5 text-left">
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium">{title}</span>
        <span className="block text-[0.8125rem] text-text-2">{subtitle}</span>
        {children}
      </span>
      <Icon name="chevron_right" className="text-text-3" />
    </button>
  );
}

function StepRow({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3 p-4">
      <span className="money mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-text text-[0.6875rem] font-medium text-bg">{n}</span>
      <span>
        <span className="block text-[0.9375rem] font-medium">{title}</span>
        <span className="mt-0.5 block text-[0.8125rem] leading-snug text-text-2">{body}</span>
      </span>
    </li>
  );
}

/** Full-width black pill (white in dark mode), as in the reference "Continue". */
function PillButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="press mt-3 h-[3.25rem] w-full shrink-0 rounded-full bg-text text-[1rem] font-medium text-bg shadow-e1 transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}
