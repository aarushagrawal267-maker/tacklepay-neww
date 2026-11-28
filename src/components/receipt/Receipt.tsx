"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge, DemoBadge, DemoNotice } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { NotFound } from "@/components/ui/NotFound";
import { Perforation } from "@/components/ui/Perforation";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { formatFull, groupRef } from "@/lib/format";
import { useContact } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import { participantOf, PARTICIPANTS } from "@/lib/tpi";
import type { TxMethod } from "@/lib/types";
import { SuccessMark } from "./SuccessMark";
import { Watermark } from "./Watermark";

const METHOD_LABEL: Record<TxMethod, string> = {
  contact: "Paid from chat",
  qr: "Paid by scanning a QR code",
  phone: "Paid to a phone number",
  bank: "Bank transfer",
  bill: "Bill payment",
  recharge: "Mobile recharge",
  reward: "Scratch card reward",
  self: "Self transfer",
  topup: "Added from your demo bank",
  welcome: "Starting demo balance",
};

const PAYMENT_METHODS: TxMethod[] = ["contact", "qr", "phone", "bank", "bill", "recharge"];

/** "TacketPay → Tacket": which participants a TPI payment crossed. */
function route(from: string, to: string): string {
  const a = participantOf(from);
  const b = participantOf(to);
  return a && b ? `${PARTICIPANTS[a].name} → ${PARTICIPANTS[b].name}` : "TPI";
}

export function Receipt() {
  const { id } = useParams<{ id: string }>();
  const fresh = useSearchParams().get("fresh") === "1";
  const router = useRouter();
  const hydrated = useHydrated();
  const tx = useStore((s) => s.transactions.find((t) => t.id === id));
  const profile = useStore((s) => s.profile);
  const account = useStore((s) => s.accounts.find((a) => a.id === tx?.accountId));
  const contact = useContact(tx?.contactId);
  const synced = useStore((s) => !!s.rev);

  if (!hydrated || (!tx && !synced)) return <ScreenSkeleton />;
  if (!tx) return <NotFound title="Receipt not found" body="It isn't in this account's TPI history." />;

  const debit = tx.direction === "debit";
  const reversed = tx.status === "reversed";
  const viaTpi = !!tx.txnId;
  const payer = debit ? profile.handle : tx.counterpartyHandle;
  const payee = debit ? tx.counterpartyHandle : profile.handle;
  const typeLabel = !debit && PAYMENT_METHODS.includes(tx.method) ? "Received over TPI" : METHOD_LABEL[tx.method];

  const share = async () => {
    const outcome = reversed ? "Failed, refunded" : debit ? "Paid" : "Received";
    const text = `TacketPay DEMO receipt — not a real payment.\n${outcome} ${formatMoney(tx.amount)} ${debit ? "to" : "from"} ${tx.counterpartyName} (${tx.counterpartyHandle})\n${formatFull(tx.at)}\nDemo RRN ${tx.ref}`;
    try {
      if (navigator.share) await navigator.share({ title: "TacketPay demo receipt", text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Receipt copied");
      }
    } catch {
      // Dismissed.
    }
  };

  const done = () => router.replace(contact && contact.kind !== "biller" ? `/chat/${contact.id}` : "/");

  return (
    <div className={`flex h-full flex-col bg-bg ${fresh ? "animate-fade" : "animate-screen"}`}>
      <TopBar
        elevated
        nav="close"
        onNav={fresh ? done : undefined}
        title={fresh ? "" : "Transaction details"}
        menu={[{ label: "Share receipt", onSelect: share }, { label: "Send feedback" }]}
      />
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        {/* One stub: the amount on top, torn along the perforation from the counterfoil details. */}
        <article className="stub mx-4 mt-3 rounded-2xl bg-surface">
          <section className="relative px-6 pb-6 pt-7 text-center">
            <Watermark />
            {reversed ? (
              <span className="relative mx-auto grid size-16 place-items-center rounded-full bg-danger-soft text-danger">
                <Icon name="undo" size={34} />
              </span>
            ) : (
              <div className={`relative flex flex-col items-center ${debit ? "text-primary" : "text-success"}`}>
                <SuccessMark animate={fresh} />
              </div>
            )}
            <p className={`relative mt-4 text-[0.9375rem] text-text-2 ${fresh ? "animate-rise [animation-delay:250ms]" : ""}`}>
              {reversed ? `Couldn't pay ${tx.counterpartyName}` : `${debit ? "Paid to" : "Received from"} ${tx.counterpartyName}`}
            </p>
            <p
              className={`money relative mt-1 text-[2.5rem] font-medium leading-tight ${reversed ? "text-text-3 line-through" : debit ? "text-text" : "text-success"} ${fresh ? "animate-rise [animation-delay:320ms]" : ""}`}
            >
              {formatMoney(tx.amount)}
            </p>
            <p className="relative mt-1 text-[0.8125rem] text-text-3">{formatFull(tx.at)}</p>
            <div className="relative mt-4 flex justify-center gap-2">
              {reversed ? (
                <Badge tone="danger">Failed · money returned</Badge>
              ) : (
                <Badge tone={tx.status === "pending" ? "warn" : "success"}>{tx.status === "pending" ? "Processing" : debit ? "Paid" : "Received"}</Badge>
              )}
              <DemoBadge />
            </div>
            <p className="relative mt-3 text-[0.8125rem] text-text-3">Not a real payment</p>
          </section>

          <Perforation />

          <section className="relative">
            <Watermark />
            <dl className="relative divide-y divide-line">
              <Row label={debit ? "To" : "From"}>
                <div className="flex items-center gap-3">
                  {contact && <ContactAvatar contact={contact} size={36} />}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tx.counterpartyName}</p>
                    <p className="truncate text-xs text-text-2">{tx.counterpartyHandle}</p>
                  </div>
                </div>
              </Row>
              <Row label={debit ? "From" : "To"}>
                <p className="font-medium">{profile.name || "You"}</p>
                <p className="text-xs text-text-2">{account ? `${account.bank} ${account.last4}` : "Demo account"}</p>
              </Row>
              {tx.note && <Row label="Note">{tx.note}</Row>}
              <Row label={viaTpi ? "RRN (same on both phones)" : "Demo reference"}>
                <span className="money text-[0.875rem]">{groupRef(tx.ref)}</span>
              </Row>
              {viaTpi && (
                <Row label="TPI transaction ID">
                  <span className="money text-[0.875rem]">{tx.txnId}</span>
                </Row>
              )}
              {viaTpi && <Row label="Network">{route(payer, payee)}</Row>}
              <Row label="Type">{typeLabel}</Row>
            </dl>
          </section>
        </article>

        {reversed && (
          <p className="mx-4 mt-3 rounded-2xl border border-line p-4 text-sm text-text-2">
            {tx.counterpartyName}&apos;s side couldn&apos;t accept this payment, so TPI reversed it and returned {formatMoney(tx.amount)} to your account.
          </p>
        )}

        <div className="mx-4 mt-3">
          <DemoNotice>TacketPay receipts are for demos only. They are not proof of payment and can&apos;t be used with any bank or merchant.</DemoNotice>
        </div>

        <div className="flex gap-3 px-3 pb-8 pt-4">
          <Button variant="outlined" icon="share" className="flex-1" onClick={share}>
            Share
          </Button>
          {fresh ? (
            <Button className="flex-1" onClick={done}>
              Done
            </Button>
          ) : (
            <Link href="/transactions" className="press inline-flex h-11 flex-1 items-center justify-center rounded-[0.625rem] bg-primary text-[0.9375rem] font-medium text-white">
              All transactions
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs text-text-2">{label}</dt>
      <dd className="mt-1 text-sm text-text">{children}</dd>
    </div>
  );
}
