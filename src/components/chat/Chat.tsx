"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Badge, DemoBadge } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { NotFound } from "@/components/ui/NotFound";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { errorText, sync, tpiApi } from "@/lib/api";
import { formatDay, formatShort, formatTime } from "@/lib/format";
import { useContact } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import { useHydrated, useStore } from "@/lib/store";
import type { Message, Transaction } from "@/lib/types";

type Item = { at: number; key: string } & ({ kind: "msg"; msg: Message } | { kind: "tx"; tx: Transaction });

const SOON = "This option isn't available in the demo";

export function Chat() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const synced = useStore((s) => !!s.rev);
  const contact = useContact(id);
  const messages = useStore((s) => s.messages);
  const transactions = useStore((s) => s.transactions);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const mine = messages.filter((m) => m.contactId === id);
    const linked = new Set(mine.flatMap((m) => (m.type === "payment" ? [m.txId] : [])));
    // Payments come from the books, not the chat log, so both phones show the same history.
    const orphans = transactions.filter((t) => t.contactId === id && !linked.has(t.id));
    return [
      ...mine.map((m): Item => ({ kind: "msg", msg: m, at: m.at, key: m.id })),
      ...orphans.map((t): Item => ({ kind: "tx", tx: t, at: t.at, key: t.id })),
    ].sort((a, b) => a.at - b.at);
  }, [messages, transactions, id]);

  const rows = useMemo(
    () =>
      items.map((item, i) => {
        const day = formatDay(item.at);
        return { item, day, showDay: i === 0 || day !== formatDay(items[i - 1].at) };
      }),
    [items],
  );

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  if (!hydrated || (!contact && !synced)) return <ScreenSkeleton />;
  if (!contact) return <NotFound title="Chat not found" body="This person or shop isn't on the TPI network." />;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await tpiApi.message({ toHandle: contact.handle, text: draft });
      setDraft("");
    } catch (err) {
      toast(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-screen flex h-full flex-col bg-bg">
      <TopBar
        title={
          <span className="flex items-center gap-3">
            <ContactAvatar contact={contact} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{contact.name}</span>
              <span className="block truncate text-xs font-normal text-text-2">{contact.phone ?? contact.subtitle ?? contact.handle}</span>
            </span>
          </span>
        }
        menu={[
          { label: "Block", onSelect: () => toast(SOON) },
          { label: "Disable chat", onSelect: () => toast(SOON) },
          { label: "Report spam", onSelect: () => toast(SOON) },
          { label: "Refresh", onSelect: () => void sync().then(() => toast("Up to date")) },
          { label: "Send feedback" },
        ]}
      />

      <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2" aria-live="polite">
        {items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <ContactAvatar contact={contact} size={72} />
            <p className="mt-4 text-lg font-medium">{contact.name}</p>
            <p className="text-sm text-text-2">{contact.handle}</p>
            <p className="mt-6 text-sm text-text-2">Payments and messages with {contact.name} will show up here. All amounts are demo money.</p>
          </div>
        )}
        {rows.map(({ item, day, showDay }) => {
          return (
            <div key={item.key}>
              {showDay && (
                <p className="my-4 text-center">
                  <span className="rounded-md bg-surface-3 px-2 py-1 text-xs text-text-2">{day}</span>
                </p>
              )}
              {item.kind === "tx" ? <PaymentBubble tx={item.tx} name={contact.name} /> : <MessageView msg={item.msg} contactId={id} name={contact.name} />}
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="flex shrink-0 items-center gap-2 border-t border-line bg-bg px-3 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
        {!composing && (
          <>
            <Link href={`/pay/${id}`} className="press flex h-10 items-center rounded-[0.625rem] bg-primary px-5 text-sm font-medium text-white">
              Pay
            </Link>
            <Link href={`/request/${id}`} className="press flex h-10 items-center rounded-[0.625rem] border border-button-line bg-button px-4 text-sm font-medium text-text shadow-e1">
              Request
            </Link>
          </>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setComposing(true)}
          onBlur={() => !draft && setComposing(false)}
          placeholder={composing ? `Message ${contact.name}` : "Message…"}
          aria-label={`Message ${contact.name}`}
          maxLength={500}
          className="h-10 min-w-0 flex-1 rounded-[0.625rem] border border-line bg-surface-2 px-3.5 text-base text-text outline-none placeholder:text-[0.9375rem] placeholder:text-text-3 focus:border-primary-fg"
        />
        {composing && (
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Send" className="press grid size-10 place-items-center rounded-[0.625rem] bg-primary text-white disabled:opacity-40">
            <Icon name="send" size={20} />
          </button>
        )}
      </form>
    </div>
  );
}

function MessageView({ msg, contactId, name }: { msg: Message; contactId: string; name: string }) {
  const tx = useStore((s) => (msg.type === "payment" ? s.transactions.find((t) => t.id === msg.txId) : undefined));
  const mine = msg.from === "me";
  if (msg.type === "payment") return tx ? <PaymentBubble tx={tx} name={name} /> : null;
  if (msg.type === "request") return <RequestBubble msg={msg} contactId={contactId} name={name} />;
  return (
    <div className={`mt-1.5 flex ${mine ? "justify-end pl-[25%]" : "pr-[25%]"}`}>
      <p
        className={`rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-snug ${mine ? "border border-line bg-surface dark:border-transparent dark:bg-surface-3" : "bg-surface-2"}`}
        title={formatTime(msg.at)}
      >
        {msg.text}
      </p>
    </div>
  );
}

function PaymentBubble({ tx, name }: { tx: Transaction; name: string }) {
  const out = tx.direction === "debit";
  const reversed = tx.status === "reversed";
  return (
    <div className={`mt-2 flex ${out ? "justify-end" : ""}`}>
      <Link href={`/receipt/${tx.id}`} className="press block w-[15rem] rounded-2xl border border-line bg-surface p-4">
        <p className="text-xs text-text-2">{out ? `Payment to ${name}` : `Payment to you`}</p>
        <p className="money mt-1.5 text-[1.625rem] font-medium leading-tight">{formatMoney(tx.amount)}</p>
        {tx.note && <p className="mt-0.5 truncate text-sm text-text-2">{tx.note}</p>}
        <p className="mt-3 flex items-center gap-2 text-xs text-text-2">
          {reversed ? <Badge tone="danger">Failed · refunded</Badge> : <Badge tone={tx.status === "pending" ? "warn" : "success"}>{tx.status === "pending" ? "Processing" : out ? "Paid" : "Received"}</Badge>}
          {formatShort(tx.at)}
          <DemoBadge compact className="ml-auto" />
        </p>
      </Link>
    </div>
  );
}

function RequestBubble({ msg, contactId, name }: { msg: Extract<Message, { type: "request" }>; contactId: string; name: string }) {
  const mine = msg.from === "me";
  const status = { pending: "Pending", paid: "Paid", declined: "Declined", cancelled: "Cancelled" }[msg.status];
  const [busy, setBusy] = useState(false);
  const respond = async (action: "decline" | "cancel") => {
    setBusy(true);
    try {
      await tpiApi.respond({ messageId: msg.id, action });
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`mt-2 flex ${mine ? "justify-end" : ""}`}>
      <div className="w-[15rem] rounded-2xl bg-surface-2 p-5">
        <p className="text-xs text-text-2">{mine ? `You requested from ${name}` : `${name} requested`}</p>
        <p className="money mt-1.5 text-[1.625rem] font-medium leading-tight">{formatMoney(msg.amount)}</p>
        {msg.note && <p className="mt-0.5 truncate text-sm text-text-2">{msg.note}</p>}
        <p className="mt-3 flex items-center gap-2 text-xs text-text-2">
          <Badge tone={msg.status === "paid" ? "success" : msg.status === "pending" ? "warn" : "neutral"}>{status}</Badge>
          {formatShort(msg.at)}
        </p>
        {msg.status === "pending" &&
          (mine ? (
            <button type="button" disabled={busy} onClick={() => respond("cancel")} className="press mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-[0.625rem] border border-button-line bg-button text-sm font-medium shadow-e1">
              Cancel request
            </button>
          ) : (
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={() => respond("decline")} className="press h-9 flex-1 rounded-[0.625rem] border border-button-line bg-button text-sm font-medium shadow-e1">
                Decline
              </button>
              <Link href={`/pay/${contactId}?am=${msg.amount}&req=${msg.id}`} className="press grid h-9 flex-1 place-items-center rounded-[0.625rem] bg-primary text-sm font-medium text-white">
                Pay
              </Link>
            </div>
          ))}
      </div>
    </div>
  );
}
