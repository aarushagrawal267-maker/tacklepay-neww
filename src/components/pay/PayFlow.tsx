"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { NotFound } from "@/components/ui/NotFound";
import { toast } from "@/components/ui/toast";
import { useBack } from "@/components/ui/TopBar";
import { ERROR_COPY } from "@/lib/actions";
import { ApiError, errorText, idempotencyKey, tpiApi } from "@/lib/api";
import { useContact } from "@/lib/hooks";
import { formatMoney, MAX_PAYMENT_PAISE, parseAmount } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import type { TxMethod } from "@/lib/types";
import { AmountEntry } from "./AmountEntry";
import { ConfirmSheet } from "./ConfirmSheet";
import { PinScreen } from "./PinScreen";
import { Processing } from "./Processing";

const METHODS: TxMethod[] = ["contact", "qr", "phone", "bank", "bill", "recharge"];
const MIN_PROCESSING_MS = 900;

type Phase = "amount" | "confirm" | "pin" | "processing";

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, Math.max(0, ms)));

/**
 * Amount → "Process to pay" sheet → demo PIN → TPI → receipt.
 * Query: am (paise), tn (note), src=qr, method, bill (linked bill id), req (request being paid),
 * lock=1 (fixed amount), detail (one line shown on the confirm sheet, e.g. a recharge plan).
 */
export function PayFlow({ mode }: { mode: "pay" | "request" }) {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const back = useBack(`/chat/${id}`);
  const hydrated = useHydrated();
  const synced = useStore((s) => !!s.rev);
  const contact = useContact(id);
  const me = useStore((s) => s.profile.name) || "You";
  const handle = useStore((s) => s.profile.handle);
  const accounts = useStore((s) => s.accounts);

  const initialPaise = Number(params.get("am")) || 0;
  const requestId = params.get("req");
  const locked = (params.get("lock") === "1" || !!requestId) && initialPaise > 0;
  const methodParam = params.get("src") === "qr" ? "qr" : (params.get("method") as TxMethod | null);
  const method: TxMethod = methodParam && METHODS.includes(methodParam) ? methodParam : "contact";
  const billId = params.get("bill");
  const detail = params.get("detail");

  const [text, setText] = useState(initialPaise > 0 ? String(initialPaise / 100) : "");
  const [note, setNote] = useState(params.get("tn") ?? "");
  const [phase, setPhase] = useState<Phase>(locked ? "confirm" : "amount");
  const [error, setError] = useState<string>();
  const [pinError, setPinError] = useState<string>();
  const [accountId, setAccountId] = useState<string>();
  const [attempt, setAttempt] = useState("");
  // Set when the last try ended without a clear answer (offline or a server error): it may have paid.
  const [unsureOf, setUnsureOf] = useState<string>();
  const chosenAccount = accountId ?? (accounts.find((a) => a.primary) ?? accounts[0])?.id;

  // Routes stay mounted (hidden) after you leave, so leave them clean for the next visit.
  const reset = useCallback(() => {
    setText(initialPaise > 0 ? String(initialPaise / 100) : "");
    setNote(params.get("tn") ?? "");
    setPhase(locked ? "confirm" : "amount");
    setError(undefined);
    setPinError(undefined);
    setAccountId(undefined);
    setUnsureOf(undefined);
  }, [initialPaise, params, locked]);
  const exit = useCallback(() => {
    reset();
    back();
  }, [reset, back]);

  const amount = parseAmount(text) ?? 0;
  /** What the idempotency key stands for: retrying the same payment may reuse it, a different one may not. */
  const payment = [contact?.handle, amount, chosenAccount, requestId ?? "", billId ?? ""].join("|");

  const next = useCallback(async () => {
    setError(undefined);
    if (amount <= 0) return setError(ERROR_COPY.INVALID_AMOUNT);
    if (amount > MAX_PAYMENT_PAISE) return setError(ERROR_COPY.AMOUNT_TOO_LARGE);
    if (mode === "pay" && amount > (accounts.find((a) => a.id === chosenAccount)?.balance ?? 0) && accounts.length === 1) {
      return setError(ERROR_COPY.INSUFFICIENT_FUNDS);
    }
    if (mode === "request") {
      if (!contact) return;
      try {
        await tpiApi.request({ fromHandle: contact.handle, amount, note: note || undefined });
      } catch (err) {
        return setError(errorText(err));
      }
      toast(`Requested ${formatMoney(amount)} from ${contact.name}`);
      router.replace(`/chat/${id}`);
      window.setTimeout(reset, 400);
      return;
    }
    setPhase("confirm");
  }, [amount, mode, id, note, router, accounts, chosenAccount, reset, contact]);

  const proceed = () => {
    const account = accounts.find((a) => a.id === chosenAccount);
    if (!account) return setError(ERROR_COPY.UNKNOWN_ACCOUNT);
    if (account.balance < amount) return setError(ERROR_COPY.INSUFFICIENT_FUNDS);
    setError(undefined);
    setPinError(undefined);
    // One key per payment attempt: if the request is retried, TPI pays at most once. After an unclear
    // failure the same payment keeps its key, so if the first try did go through, TPI returns it
    // instead of paying again.
    if (!(attempt && unsureOf === payment)) setAttempt(idempotencyKey());
    setUnsureOf(undefined);
    setPhase("pin");
  };

  const onPinDone = useCallback(
    async (pin: string) => {
      if (!contact) return;
      setPhase("processing");
      const started = Date.now();
      try {
        const { payment } = await tpiApi.pay({
          payeeHandle: contact.handle,
          payeeName: contact.kind === "bank" ? contact.name : undefined,
          amount,
          note: note || undefined,
          method,
          accountId: chosenAccount,
          pin,
          requestId: requestId ?? undefined,
          billId: billId ?? undefined,
          idemKey: attempt,
        });
        await wait(MIN_PROCESSING_MS - (Date.now() - started));
        if (payment.state === "REVERSED") {
          toast(`${contact.name} couldn't receive it, so TPI returned ${formatMoney(amount)} to you`, 5000);
        } else if (navigator.vibrate) {
          navigator.vibrate([30, 60, 30]);
        }
        router.replace(payment.activityId ? `/receipt/${payment.activityId}?fresh=1` : "/transactions");
        window.setTimeout(reset, 400);
      } catch (err) {
        await wait(MIN_PROCESSING_MS / 2 - (Date.now() - started));
        const code = err instanceof ApiError ? err.code : "INTERNAL";
        setUnsureOf(code === "OFFLINE" || code === "INTERNAL" ? payment : undefined);
        if (code === "PIN_INVALID") {
          setPinError(errorText(err));
          setPhase("pin");
          return;
        }
        setError(errorText(err));
        setPhase(locked || code === "PIN_LOCKED" ? "confirm" : "amount");
      }
    },
    [contact, amount, note, method, chosenAccount, requestId, billId, attempt, payment, locked, router, reset],
  );

  if (!hydrated || (!contact && !synced)) return <ScreenSkeleton />;
  if (!contact) return <NotFound title="Contact not found" body="This person or shop isn't on the TPI network." />;

  const account = accounts.find((a) => a.id === chosenAccount);

  return (
    <div className="h-full">
      <div className="h-full" inert={phase !== "amount"}>
      <AmountEntry
        contact={contact}
        me={me}
        mode={mode}
        text={text}
        onText={(t) => {
          setText(t);
          setError(undefined);
        }}
        note={note}
        onNote={setNote}
        error={phase === "amount" ? error : undefined}
        locked={locked}
        keyboard={phase === "amount"}
        onNext={next}
        onClose={exit}
      />
      </div>
      <ConfirmSheet
        open={phase === "confirm"}
        onClose={() => (locked ? exit() : setPhase("amount"))}
        contact={contact}
        me={me}
        amount={amount}
        note={note || undefined}
        accounts={accounts}
        accountId={chosenAccount ?? ""}
        onAccount={(a) => {
          setAccountId(a);
          setError(undefined);
        }}
        handle={handle}
        error={phase === "confirm" ? error : undefined}
        detail={detail ? <p className="mt-1 max-w-[17.5rem] text-xs text-text-2">{detail}</p> : undefined}
        onPay={proceed}
      />
      {phase === "pin" && (
        <PinScreen
          bank={account ? `${account.bank} ${account.last4}` : "Demo bank"}
          amount={amount}
          payee={contact.name}
          error={pinError}
          onDone={onPinDone}
          onCancel={() => setPhase("confirm")}
        />
      )}
      {phase === "processing" && <Processing amount={amount} payee={contact.name} />}
    </div>
  );
}
