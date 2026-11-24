// Double-entry bookkeeping shared by every participant. Money is integer paise; every journal
// sums to zero, so demo money is only ever moved, never created — except by TacketPay's mint.
import type { ParticipantId } from "@/lib/tpi";
import { atomic, sql, TpiError, type Tpi } from "./db";

export type AccountKind = "wallet" | "mint" | "clearing" | "merchant" | "external";

export interface LedgerAccount {
  id: string;
  participant: ParticipantId;
  kind: AccountKind;
  owner: string | null;
  bank: string | null;
  last4: string | null;
  acct_type: string | null;
  is_primary: number;
  balance: number;
  cap: number | null;
  system: number;
  created_at: number;
}

/** The two system accounts a participant keeps: where money is created, and what it owes the network. */
export function systemAccount(participant: ParticipantId, kind: "mint" | "clearing"): string {
  return `${participant}:${kind}`;
}

export function ensureSystemAccounts(t: Tpi, participant: ParticipantId) {
  const insert = sql(t, "INSERT OR IGNORE INTO ledger_accounts (id, participant, kind, system, created_at) VALUES (?, ?, ?, 1, ?)");
  insert.run(systemAccount(participant, "clearing"), participant, "clearing", t.now());
  if (participant === "tpay") insert.run(systemAccount(participant, "mint"), participant, "mint", t.now());
}

export function openAccount(
  t: Tpi,
  a: { id: string; participant: ParticipantId; kind: AccountKind; owner: string; bank?: string; last4?: string; type?: string; primary?: boolean; cap?: number },
): string {
  sql(
    t,
    `INSERT INTO ledger_accounts (id, participant, kind, owner, bank, last4, acct_type, is_primary, cap, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(a.id, a.participant, a.kind, a.owner, a.bank ?? null, a.last4 ?? null, a.type ?? null, a.primary ? 1 : 0, a.cap ?? null, t.now());
  return a.id;
}

export function getAccount(t: Tpi, id: string): LedgerAccount | undefined {
  return sql(t, "SELECT * FROM ledger_accounts WHERE id = ?").get(id) as LedgerAccount | undefined;
}

/**
 * Posts a balanced journal for one participant. Throws INSUFFICIENT_FUNDS when an account would
 * go below zero, LIMIT_EXCEEDED when it would pass its cap; nothing is written in either case.
 * `ignoreCap` is for reversals, which must always land.
 */
export function post(
  t: Tpi,
  j: { participant: ParticipantId; txnId?: string; kind: string; memo?: string; lines: { account: string; amount: number }[]; ignoreCap?: boolean },
): string {
  const sum = j.lines.reduce((s, l) => s + l.amount, 0);
  if (sum !== 0 || j.lines.some((l) => !Number.isSafeInteger(l.amount))) throw new TpiError("INTERNAL", 500);
  return atomic(t, () => {
    const id = `j_${t.id()}`;
    sql(t, "INSERT INTO journals (id, participant, txn_id, kind, memo, at) VALUES (?, ?, ?, ?, ?, ?)").run(
      id,
      j.participant,
      j.txnId ?? null,
      j.kind,
      j.memo ?? null,
      t.now(),
    );
    const move = sql(
      t,
      `UPDATE ledger_accounts SET balance = balance + ?1
       WHERE id = ?2 AND participant = ?3
         AND (system = 1 OR balance + ?1 >= 0)
         AND (?4 = 1 OR cap IS NULL OR ?1 <= 0 OR balance + ?1 <= cap)`,
    );
    const line = sql(t, "INSERT INTO postings (journal_id, account_id, amount) VALUES (?, ?, ?)");
    for (const l of j.lines) {
      if (move.run(l.amount, l.account, j.participant, j.ignoreCap ? 1 : 0).changes === 0) {
        const acct = getAccount(t, l.account);
        if (!acct || acct.participant !== j.participant) throw new TpiError("UNKNOWN_ACCOUNT");
        throw new TpiError(acct.balance + l.amount < 0 ? "INSUFFICIENT_FUNDS" : "LIMIT_EXCEEDED");
      }
      line.run(id, l.account, l.amount);
    }
    return id;
  });
}

/** Sum of every balance on the network. Always zero: the mint's negative balance is all the money in circulation. */
export function ledgerSum(t: Tpi): number {
  return (sql(t, "SELECT COALESCE(SUM(balance), 0) AS s FROM ledger_accounts").get() as { s: number }).s;
}
