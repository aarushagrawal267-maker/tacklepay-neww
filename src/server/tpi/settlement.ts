// Settlement and reconciliation (plan §7), for demo money.
//
// Between cycles, every payment leaves a trace in each participant's TPI clearing account: the payer's
// participant owes the network, the payee's is owed by it. Closing a cycle nets those positions per
// participant over the finished payments since the last cycle, refuses to close unless they sum to exactly
// zero and every payment reconciles, then posts one settlement journal per participant that moves its
// clearing balance into its settlement account. No bank is involved: settlement is bookkeeping only.
import { FINAL_STATES, PARTICIPANTS, type ParticipantId, type ReconException, type SettlementCycleView, type SettlementView } from "@/lib/tpi";
import { atomic, sql, TpiError, type Tpi } from "./db";
import { post, systemAccount } from "./ledger";
import type { TxnRow } from "./records";

const PIDS = Object.keys(PARTICIPANTS) as ParticipantId[];
const SETTLEABLE = ["SUCCESS", "REVERSED"] as const;

type Kind = "debit" | "credit" | "reversal";

/**
 * What each participant's clearing account should show for a finished payment, keyed by `pid:kind`.
 * Debit: payer's clearing +amount. Credit: payee's clearing −amount. Reversal: payer's clearing −amount.
 */
function expectedPostings(txn: TxnRow): Map<string, number> {
  const out = new Map<string, number>();
  if (txn.state === "SUCCESS") {
    out.set(`${txn.payer_pid}:debit`, txn.amount);
    if (txn.payee_pid) out.set(`${txn.payee_pid}:credit`, -txn.amount);
  } else if (txn.state === "REVERSED") {
    out.set(`${txn.payer_pid}:debit`, txn.amount);
    out.set(`${txn.payer_pid}:reversal`, -txn.amount);
  }
  // FAILED: nothing may have been posted anywhere.
  return out;
}

/** Clearing-account postings each participant actually made for these transactions, keyed by txn then `pid:kind`. */
function actualPostings(t: Tpi, txnIds: string[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  if (txnIds.length === 0) return out;
  // Chunk to stay well under SQLite's bound-parameter limit.
  for (let i = 0; i < txnIds.length; i += 500) {
    const chunk = txnIds.slice(i, i + 500);
    const rows = sql(
      t,
      `SELECT j.txn_id AS txn_id, j.participant AS pid, j.kind AS kind, COALESCE(SUM(p.amount), 0) AS amount
       FROM journals j JOIN postings p ON p.journal_id = j.id AND p.account_id = j.participant || ':clearing'
       WHERE j.txn_id IN (${chunk.map(() => "?").join(", ")})
       GROUP BY j.txn_id, j.participant, j.kind`,
    ).all(...chunk) as { txn_id: string; pid: ParticipantId; kind: Kind; amount: number }[];
    for (const r of rows) {
      let m = out.get(r.txn_id);
      if (!m) out.set(r.txn_id, (m = new Map()));
      m.set(`${r.pid}:${r.kind}`, r.amount);
    }
  }
  return out;
}

/**
 * Reconciliation: compares the switch's record of every finished payment with what each participant
 * actually booked. Any payment missing on one side, or booked with a different amount, is an exception.
 */
export function reconcile(t: Tpi, opts: { onlyUnsettled?: boolean } = {}): ReconException[] {
  const txns = sql(
    t,
    `SELECT * FROM tpi_txns WHERE state IN (${FINAL_STATES.map(() => "?").join(", ")})
     ${opts.onlyUnsettled ? "AND txn_id NOT IN (SELECT txn_id FROM settlement_items)" : ""}
     ORDER BY created_at, rowid`,
  ).all(...FINAL_STATES) as unknown as TxnRow[];
  const actual = actualPostings(
    t,
    txns.map((x) => x.txn_id),
  );
  const out: ReconException[] = [];
  for (const txn of txns) {
    const want = expectedPostings(txn);
    const got = actual.get(txn.txn_id) ?? new Map<string, number>();
    for (const key of new Set([...want.keys(), ...got.keys()])) {
      const w = want.get(key) ?? 0;
      const g = got.get(key) ?? 0;
      if (w === g) continue;
      const [pid, kind] = key.split(":") as [ParticipantId, Kind];
      const problem =
        g === 0 ? `missing ${kind}: switch says ${txn.state}, participant booked nothing` : w === 0 ? `unexpected ${kind} of ${Math.abs(g)} paise` : `${kind} booked as ${Math.abs(g)} paise, switch says ${Math.abs(w)}`;
      out.push({ txnId: txn.txn_id, rrn: txn.rrn, state: txn.state, participant: pid, problem });
    }
  }
  return out;
}

function unsettledTxns(t: Tpi): TxnRow[] {
  return sql(
    t,
    `SELECT * FROM tpi_txns WHERE state IN (${SETTLEABLE.map(() => "?").join(", ")})
       AND txn_id NOT IN (SELECT txn_id FROM settlement_items)
     ORDER BY created_at, rowid`,
  ).all(...SETTLEABLE) as unknown as TxnRow[];
}

/** Net position per participant over these payments: credits received minus debits sent. Reversed payments net to zero. */
export function netPositions(txns: TxnRow[]): Map<ParticipantId, { net: number; txnCount: number }> {
  const out = new Map<ParticipantId, { net: number; txnCount: number }>();
  const bump = (pid: ParticipantId, delta: number) => {
    const p = out.get(pid) ?? { net: 0, txnCount: 0 };
    p.net += delta;
    p.txnCount += 1;
    out.set(pid, p);
  };
  for (const txn of txns) {
    const success = txn.state === "SUCCESS";
    bump(txn.payer_pid, success ? -txn.amount : 0);
    if (txn.payee_pid && txn.payee_pid !== txn.payer_pid) bump(txn.payee_pid, success ? txn.amount : 0);
    else if (txn.payee_pid === txn.payer_pid && success) out.get(txn.payer_pid)!.net += txn.amount;
  }
  return out;
}

/**
 * Closes a settlement cycle over every finished payment not yet settled. Refuses (RECON_MISMATCH) when any
 * of those payments fails reconciliation or the net positions don't sum to zero; nothing is written then.
 */
export function closeCycle(t: Tpi, trigger: "manual" | "timer" = "manual"): SettlementCycleView {
  return atomic(t, () => {
    const txns = unsettledTxns(t);
    if (txns.length === 0) throw new TpiError("NOTHING_TO_SETTLE", 409);
    if (reconcile(t, { onlyUnsettled: true }).length > 0) throw new TpiError("RECON_MISMATCH", 409);
    const positions = netPositions(txns);
    const sum = [...positions.values()].reduce((s, p) => s + p.net, 0);
    if (sum !== 0) throw new TpiError("RECON_MISMATCH", 409);

    const last = sql(t, "SELECT MAX(closed_at) AS at FROM settlement_cycles").get() as { at: number | null };
    // `txns` is ordered by created_at, so the first is the oldest (no spread: it overflows the stack on big sets).
    const openedAt = last.at ?? txns[0].created_at;
    const gross = txns.filter((x) => x.state === "SUCCESS").reduce((s, x) => s + x.amount, 0);
    const res = sql(t, "INSERT INTO settlement_cycles (opened_at, closed_at, txn_count, gross, trigger) VALUES (?, ?, ?, ?, ?)").run(
      openedAt,
      t.now(),
      txns.length,
      gross,
      trigger,
    );
    const cycleId = Number(res.lastInsertRowid);

    const insertPos = sql(t, "INSERT INTO settlement_positions (cycle_id, participant, net, txn_count, journal_id) VALUES (?, ?, ?, ?, ?)");
    for (const [pid, p] of positions) {
      // Clearing is positive when the participant owes the network, so settling a position of `net` moves +net into clearing.
      const journal =
        p.net === 0
          ? null
          : post(t, {
              participant: pid,
              kind: "settlement",
              memo: `Settlement cycle ${cycleId}`,
              lines: [
                { account: systemAccount(pid, "clearing"), amount: p.net },
                { account: systemAccount(pid, "settlement"), amount: -p.net },
              ],
            });
      insertPos.run(cycleId, pid, p.net, p.txnCount, journal);
    }
    const item = sql(t, "INSERT INTO settlement_items (txn_id, cycle_id) VALUES (?, ?)");
    for (const x of txns) item.run(x.txn_id, cycleId);
    return cycleView(t, cycleId)!;
  });
}

function cycleView(t: Tpi, id: number): SettlementCycleView | undefined {
  const c = sql(t, "SELECT * FROM settlement_cycles WHERE id = ?").get(id) as
    | { id: number; opened_at: number; closed_at: number; txn_count: number; gross: number; trigger: "manual" | "timer" }
    | undefined;
  if (!c) return undefined;
  const positions = sql(t, "SELECT participant, net, txn_count FROM settlement_positions WHERE cycle_id = ? ORDER BY participant").all(id) as {
    participant: ParticipantId;
    net: number;
    txn_count: number;
  }[];
  return {
    id: c.id,
    openedAt: c.opened_at,
    closedAt: c.closed_at,
    txnCount: c.txn_count,
    gross: c.gross,
    trigger: c.trigger,
    positions: positions.map((p) => ({ participant: p.participant, net: p.net, txnCount: p.txn_count })),
  };
}

/** Cumulative net each participant has settled with the network. */
export function settledTotals(t: Tpi): Record<ParticipantId, number> {
  const rows = sql(t, "SELECT participant, COALESCE(SUM(net), 0) AS net FROM settlement_positions GROUP BY participant").all() as {
    participant: ParticipantId;
    net: number;
  }[];
  const out = Object.fromEntries(PIDS.map((p) => [p, 0])) as Record<ParticipantId, number>;
  for (const r of rows) out[r.participant] = r.net;
  return out;
}

export function settlementView(t: Tpi, limit = 10): SettlementView {
  const ids = sql(t, "SELECT id FROM settlement_cycles ORDER BY id DESC LIMIT ?").all(limit) as { id: number }[];
  return {
    unsettled: unsettledTxns(t).length,
    cycles: ids.map((r) => cycleView(t, r.id)!),
    exceptions: reconcile(t),
  };
}

/** Timer job: closes a cycle when there is something to settle. Never throws; returns the cycle or why it didn't close. */
export function settleIfDue(t: Tpi): SettlementCycleView | string {
  try {
    return closeCycle(t, "timer");
  } catch (err) {
    if (err instanceof TpiError) return err.code;
    throw err;
  }
}
