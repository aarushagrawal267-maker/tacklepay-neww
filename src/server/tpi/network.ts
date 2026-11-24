// Network setup and the operator's view of TPI: who holds what, and every payment's trail.
import { MERCHANTS } from "@/lib/seed";
import { PARTICIPANTS, type NetworkView, type ParticipantId, type TpiErrorCode, type TxnState } from "@/lib/tpi";
import { atomic, sql, type Tpi } from "./db";
import { ensureSystemAccounts, ledgerSum, systemAccount } from "./ledger";
import type { TxnRow } from "./records";
import { settledTotals, settlementView } from "./settlement";

const PIDS = Object.keys(PARTICIPANTS) as ParticipantId[];

/** Registers the participants' system accounts and every Tacket shop. Safe to run on every start. */
export function bootstrap(t: Tpi) {
  atomic(t, () => {
    for (const pid of PIDS) ensureSystemAccounts(t, pid);
    const shop = sql(t, "INSERT OR IGNORE INTO merchants (id, handle, name, kind, icon, color, subtitle) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const account = sql(t, "INSERT OR IGNORE INTO ledger_accounts (id, participant, kind, owner, created_at) VALUES (?, 'tacket', 'merchant', ?, ?)");
    for (const m of MERCHANTS) {
      shop.run(m.id, m.handle, m.name, m.kind, m.icon ?? null, m.color, m.subtitle ?? null);
      account.run(`tacket:m:${m.id}`, m.id, t.now());
    }
  });
}

export function networkView(t: Tpi, limit = 40): NetworkView {
  const balanceOf = (id: string) => (sql(t, "SELECT balance FROM ledger_accounts WHERE id = ?").get(id) as { balance: number } | undefined)?.balance ?? 0;
  const settled = settledTotals(t);
  const participants = PIDS.map((id) => {
    const row = sql(t, "SELECT COUNT(*) AS n, COALESCE(SUM(balance), 0) AS held FROM ledger_accounts WHERE participant = ? AND system = 0").get(id) as {
      n: number;
      held: number;
    };
    return { id, ...PARTICIPANTS[id], accounts: row.n, holdings: row.held, clearing: balanceOf(systemAccount(id, "clearing")), settled: settled[id] };
  });
  const counts = Object.fromEntries(
    (sql(t, "SELECT state, COUNT(*) AS n FROM tpi_txns GROUP BY state").all() as { state: TxnState; n: number }[]).map((r) => [r.state, r.n]),
  ) as Partial<Record<TxnState, number>>;
  const txns = sql(t, "SELECT * FROM tpi_txns ORDER BY created_at DESC, rowid DESC LIMIT ?").all(limit) as unknown as TxnRow[];
  const events = sql(t, "SELECT to_state AS state, msg, at FROM tpi_events WHERE txn_id = ? ORDER BY id");
  return {
    participants,
    totals: {
      minted: -balanceOf(systemAccount("tpay", "mint")),
      held: participants.reduce((s, p) => s + p.holdings, 0),
      clearing: participants.reduce((s, p) => s + p.clearing, 0),
      ledgerSum: ledgerSum(t),
    },
    counts: {
      users: (sql(t, "SELECT COUNT(*) AS n FROM users").get() as { n: number }).n,
      success: counts.SUCCESS ?? 0,
      reversed: counts.REVERSED ?? 0,
      failed: counts.FAILED ?? 0,
    },
    txns: txns.map((x) => ({
      txnId: x.txn_id,
      rrn: x.rrn,
      state: x.state,
      failureCode: x.failure_code as TpiErrorCode | null,
      amount: x.amount,
      payerHandle: x.payer_handle,
      payerName: x.payer_name,
      payeeHandle: x.payee_handle,
      payeeName: x.payee_name,
      payerPid: x.payer_pid,
      payeePid: x.payee_pid,
      method: x.method,
      note: x.note,
      createdAt: x.created_at,
      events: events.all(x.txn_id) as { state: TxnState; msg: string; at: number }[],
    })),
    settlement: settlementView(t),
  };
}
