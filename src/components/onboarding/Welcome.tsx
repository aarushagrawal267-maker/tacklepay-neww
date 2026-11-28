"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Card";
import { DemoBadge, DemoNotice } from "@/components/ui/DemoBadge";
import { Field } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { errorText, tpiApi } from "@/lib/api";
import { DEMO_ACCOUNTS, PUBLIC_DEMO } from "@/lib/seed";
import { useHydrated, useStore } from "@/lib/store";

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: "science", title: "Everything is demo money", body: "You start with ₹10,000 of play money. It can't be withdrawn, spent or sent to a real bank." },
  { icon: "sync_alt", title: "Real payments, fake rupees", body: "Pay anyone on TacketPay over TPI, our UPI-style network. Their balance goes up the moment yours goes down." },
  { icon: "lock", title: "Never enter real details", body: "Pick a new 4-digit demo PIN. Never use your real UPI PIN, card PIN or bank password." },
];

const MODES = [
  { id: "signup", label: "Create account" },
  { id: "signin", label: "Sign in" },
] as const;

type Mode = (typeof MODES)[number]["id"];

function safeNext(raw: string | null): string {
  // Only allow in-app paths, never another origin.
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

export function Welcome() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.onboarded);
  const next = safeNext(params.get("next"));

  // Already signed in (here or by an earlier visit): go where we were headed.
  useEffect(() => {
    if (hydrated && onboarded) router.replace(next);
  }, [hydrated, onboarded, next, router]);

  const signup = mode === "signup";
  const phoneDigits = digits(phone, 10);
  const errors = {
    name: signup && touched && !name.trim() ? "Enter a name so friends know who's paying" : undefined,
    phone: touched && !/^[6-9]\d{9}$/.test(phoneDigits) ? "Enter a 10-digit mobile number" : undefined,
    pin: touched && pin.length !== 4 ? "Your demo PIN is exactly 4 digits" : undefined,
    pin2: signup && touched && pin2 !== pin ? "The two PINs don't match" : undefined,
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(undefined);
    if (Object.values(errors).some(Boolean) || (signup && !name.trim()) || phoneDigits.length !== 10 || pin.length !== 4 || (signup && pin2 !== pin)) return;
    setBusy(true);
    try {
      if (signup) await tpiApi.signUp({ name, phone: phoneDigits, pin });
      else await tpiApi.signIn({ phone: phoneDigits, pin });
      router.replace(next);
    } catch (err) {
      setError(errorText(err));
      setPin("");
      setPin2("");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setTouched(false);
    setError(undefined);
    setPin("");
    setPin2("");
  };

  return (
    <div className="animate-fade h-full overflow-y-auto bg-bg">
      <div className="flex min-h-full flex-col px-6 pb-8 pt-[max(28px,env(safe-area-inset-top))] @2xl:mx-auto @2xl:max-w-[34rem] @2xl:pt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <Wordmark className="text-xl" />
          </div>
          <DemoBadge />
        </div>

        <h1 className="mt-10 text-[2.125rem] font-semibold leading-[1.1] tracking-tight text-text">
          Payments,
          <br />
          <span className="text-text-3">minus the real money.</span>
        </h1>

        <ul className="mt-8 space-y-5">
          {POINTS.map((p, i) => (
            <li key={p.title} className="animate-rise flex gap-4" style={{ animationDelay: `${80 + i * 70}ms` }}>
              <span className="grid size-10 shrink-0 place-items-center rounded-[0.75rem] bg-surface-2 text-text-2 dark:bg-surface-3">
                <Icon name={p.icon} size={22} />
              </span>
              <div>
                <h2 className="text-[0.9375rem] font-medium text-text">{p.title}</h2>
                <p className="mt-0.5 text-sm leading-snug text-text-2">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>

        {PUBLIC_DEMO && (
          <DemoNotice className="mt-8">
            <strong className="font-semibold">Public demo: data resets periodically.</strong> Accounts, balances and
            payments on this server are wiped whenever it restarts. To try a payment, sign in as{" "}
            {DEMO_ACCOUNTS.map((a, i) => (
              <span key={a.phone}>
                {i > 0 && " and pay "}
                {a.name} (<span className="whitespace-nowrap">{`${a.phone.slice(0, 5)} ${a.phone.slice(5)}`}</span>, PIN {a.pin})
              </span>
            ))}
            , or create your own account with a made-up number: other visitors can see names on this server.
          </DemoNotice>
        )}

        <div className="mt-10">
          <Segmented options={MODES} value={mode} onChange={switchMode} label="Create an account or sign in" />
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          {signup && (
            <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} error={errors.name} />
          )}
          <Field
            label="Mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+-]/g, "").slice(0, 16))}
            inputMode="tel"
            autoComplete="tel-national"
            hint={signup ? "Friends can find and pay you by this number. It's never verified." : undefined}
            error={errors.phone}
          />
          <Field
            label={signup ? "Choose a 4-digit demo PIN" : "Demo PIN"}
            value={pin}
            onChange={(e) => setPin(digits(e.target.value, 4))}
            type="password"
            inputMode="numeric"
            autoComplete={signup ? "new-password" : "current-password"}
            hint={signup ? "You'll enter it to approve payments. Never your real UPI PIN." : undefined}
            error={errors.pin}
          />
          {signup && (
            <Field label="Confirm demo PIN" value={pin2} onChange={(e) => setPin2(digits(e.target.value, 4))} type="password" inputMode="numeric" autoComplete="new-password" error={errors.pin2} />
          )}
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
              <Icon name="error" size={18} className="mt-px shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block className="!mt-6" disabled={busy}>
            {busy ? "Connecting to TPI…" : signup ? "Start with ₹10,000 demo money" : "Sign in"}
          </Button>
        </form>

        <p className="mt-auto pt-8 text-center text-xs leading-relaxed text-text-3">
          TacketPay is a design demo. It isn&apos;t a bank or payment service and isn&apos;t affiliated with Google Pay or NPCI.
        </p>
      </div>
    </div>
  );
}
