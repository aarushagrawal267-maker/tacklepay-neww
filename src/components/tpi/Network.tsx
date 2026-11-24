"use client";
import { useEffect, useState } from "react";
import { Stat } from "@/components/ui/Card";
import { Badge, DemoNotice } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScrollBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { errorText, tpiApi } from "@/lib/api";
import { formatShort, formatTime, groupRef } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { PARTICIPANTS, type NetworkView, type TxnState, type TxnView } from "@/lib/tpi";

const POLL_MS = 2000;

const STATE_TONE: Partial<Record<TxnState, "success" | "danger" | "warn" | "neutral">> = {
  SUCCESS: "success",
  REVERSED: "danger",
  FAILED: "neutral",
};

/** The switch's console: what each participant holds, what it owes the network, and every payment's trail. */
export function Network() {
  const [view, setView] = useState<NetworkView>();
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<string>();

  useEffect(() => {
    let timer = 0;
    let stopped = false;
    const load = async () => {
      if (document.visibilityState === "visible") {
        try {
          setView(await tpiApi.network());
          setError(undefined);
        } catch (err) {
          setError(errorText(err));
        }
      }
      if (!stopped) timer = window.setTimeout(load, POLL_MS);
    };
    void load();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <Screen>
      <TopBar title="TPI network" />
      <ScrollBody className="px-5 pb-10 pt-4">
        <p className="text-sm leading-relaxed text-text-2">
          The switch behind every TacketPay payment. It checks the payee, debits the payer&apos;s participant, credits the payee&apos;s, and reverses the debit if the
          credit fails. Updates live.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        {!view ? (
          <div className="mt-6 space-y-3">
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="Demo money minted" value={formatMoney(view.totals.minted)} hint={`${view.counts.users} ${view.counts.users === 1 ? "person" : "people"} on TacketPay`} />
              <Stat label="Payments settled" value={view.counts.success} tone="success" hint={`${view.counts.reversed} reversed · ${view.counts.failed} failed`} />
            </div>

            <p
              className={`mt-3 flex items-center gap-2 rounded-xl px-3.5 py-3 text-sm ${view.totals.ledgerSum === 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
            >
              <Icon name={view.totals.ledgerSum === 0 ? "verified" : "warning"} size={18} />
              {view.totals.ledgerSum === 0
                ? "Books balance: every minted rupee is in an account or in clearing."
                : `Books are off by ${formatMoney(view.totals.ledgerSum)}.`}
            </p>

            <h2 className="mt-7 text-[0.8125rem] font-medium text-text-3">Participants</h2>
            <ul className="mt-2 divide-y divide-line rounded-2xl bg-surface-2">
              {view.participants.map((p) => (
                <li key={p.id} className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.9375rem] font-medium">
                      {p.name} <span className="money text-xs font-normal text-text-2">@{p.id}</span>
                    </span>
                    <span className="money text-[0.9375rem]">{formatMoney(p.holdings)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-text-2">
                    {p.role} · {p.accounts} {p.accounts === 1 ? "account" : "accounts"}
                    {p.clearing > 0 && ` · owes the network ${formatMoney(p.clearing)}`}
                    {p.clearing < 0 && ` · owed ${formatMoney(-p.clearing)} by the network`}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 px-1 text-xs leading-relaxed text-text-3">
              Clearing positions are what each participant would settle with the others. They always add up to zero.
            </p>

            <h2 className="mt-7 text-[0.8125rem] font-medium text-text-3">Recent payments</h2>
            {view.txns.length === 0 && <p className="mt-3 text-sm text-text-2">No payments yet. Pay someone and watch it go through each step here.</p>}
            <ul className="mt-2 space-y-2">
              {view.txns.map((t) => (
                <TxnCard key={t.txnId} txn={t} open={open === t.txnId} onToggle={() => setOpen(open === t.txnId ? undefined : t.txnId)} />
              ))}
            </ul>

            <DemoNotice className="mt-8">TPI is a demo network. It moves demo money between demo ledgers and never touches NPCI, UPI or a bank.</DemoNotice>
          </>
        )}
      </ScrollBody>
    </Screen>
  );
}

function TxnCard({ txn, open, onToggle }: { txn: TxnView; open: boolean; onToggle: () => void }) {
  const payer = PARTICIPANTS[txn.payerPid].name;
  const payee = txn.payeePid ? PARTICIPANTS[txn.payeePid].name : "unknown";
  return (
    <li className="rounded-2xl border border-line">
      <button type="button" onClick={onToggle} aria-expanded={open} className="press flex w-full items-start gap-3 p-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem]">
            {txn.payerName} → {txn.payeeName ?? txn.payeeHandle}
          </span>
          <span className="money block truncate text-xs text-text-2">
            RRN {groupRef(txn.rrn)} · {formatShort(txn.createdAt)} {formatTime(txn.createdAt)}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={STATE_TONE[txn.state] ?? "warn"}>{txn.state}</Badge>
            {txn.failureCode && <span className="money text-xs text-text-2">{txn.failureCode}</span>}
          </span>
        </span>
        <span className="money shrink-0 text-[0.9375rem]">{formatMoney(txn.amount)}</span>
      </button>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          <p className="text-xs text-text-2">
            {txn.payerHandle} ({payer}) → {txn.payeeHandle} ({payee})
          </p>
          <ol className="mt-3 space-y-2">
            {txn.events.map((e, i) => (
              <li key={i} className="flex gap-3 text-xs">
                <span className="money w-28 shrink-0 text-text">{e.state}</span>
                <span className="min-w-0 flex-1 text-text-2">{e.msg}</span>
              </li>
            ))}
          </ol>
          <p className="money mt-3 break-all text-[0.6875rem] text-text-3">{txn.txnId}</p>
        </div>
      )}
    </li>
  );
}
