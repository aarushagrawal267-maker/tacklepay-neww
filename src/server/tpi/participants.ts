// TPI participants: the systems that hold balances and answer the switch, like banks under UPI.
// Each one only touches its own ledger. Every handler is idempotent by (txn, message type):
// replaying a Debit, Credit or Reversal returns the stored answer instead of moving money twice.
import { BANK_HANDLE_RE, participantOf, type ParticipantId, type TpiErrorCode } from "@/lib/tpi";
import { atomic, sql, touch, TpiError, type Tpi } from "./db";
import { getAccount, post, systemAccount } from "./ledger";
import { contactIdFor, insertActivity, merchantByHandle, primaryWallet, userByHandle, type TxnRow } from "./records";

export type MsgType = "Debit" | "Credit" | "Reversal" | "Final";
export type MsgResult = { ok: true } | { ok: false; code: TpiErrorCode };
export type ValAddResult = { ok: true; name: string } | { ok: false; code: TpiErrorCode };

export interface Participant {
  id: ParticipantId;
  /** Validate a handle and return its display name, before any money moves. */
  valAdd(t: Tpi, handle: string, hint: string | null): ValAddResult;
  debit(t: Tpi, txn: TxnRow): MsgResult;
  credit(t: Tpi, txn: TxnRow): MsgResult;
  /** Undo a debit whose credit failed. Must always succeed if the debit exists. */
  reversal(t: Tpi, txn: TxnRow): MsgResult;
  /** The switch's final word on a transaction. */
  final(t: Tpi, txn: TxnRow): MsgResult;
}

function once(t: Tpi, pid: ParticipantId, txnId: string, type: MsgType, fn: () => void): MsgResult {
  const prev = sql(t, "SELECT ok, code FROM participant_msgs WHERE participant = ? AND txn_id = ? AND msg_type = ?").get(pid, txnId, type) as
    | { ok: number; code: TpiErrorCode | null }
    | undefined;
  if (prev) return prev.ok ? { ok: true } : { ok: false, code: prev.code ?? "INTERNAL" };
  const record = sql(t, "INSERT INTO participant_msgs (participant, txn_id, msg_type, ok, code, at) VALUES (?, ?, ?, ?, ?, ?)");
  try {
    atomic(t, () => {
      fn();
      record.run(pid, txnId, type, 1, null, t.now());
    });
    return { ok: true };
  } catch (err) {
    if (!(err instanceof TpiError)) throw err;
    record.run(pid, txnId, type, 0, err.code, t.now());
    return { ok: false, code: err.code };
  }
}

/** What each participant has recorded for a transaction (TPI's ChkTxn). */
export function chkTxn(t: Tpi, pid: ParticipantId, txnId: string): Partial<Record<MsgType, MsgResult>> {
  const rows = sql(t, "SELECT msg_type, ok, code FROM participant_msgs WHERE participant = ? AND txn_id = ?").all(pid, txnId) as {
    msg_type: MsgType;
    ok: number;
    code: TpiErrorCode | null;
  }[];
  return Object.fromEntries(rows.map((r) => [r.msg_type, r.ok ? { ok: true } : { ok: false, code: r.code ?? "INTERNAL" }]));
}

const REWARD_MIN = 10_00;

/** Payments of ₹10 or more earn a scratch card; about 40% say "Better luck next time". */
function maybeReward(t: Tpi, userId: string, txn: TxnRow) {
  if (txn.amount < REWARD_MIN) return;
  const value = t.random() < 0.4 ? null : (5 + Math.floor(t.random() * 46)) * 100;
  sql(t, "INSERT INTO rewards (id, user_id, amount, scratched, reason, at) VALUES (?, ?, ?, 0, ?, ?)").run(
    `r${t.id()}`,
    userId,
    value,
    `Earned for paying ${txn.payee_name ?? txn.payee_handle}`,
    t.now(),
  );
}

/** TacketPay: customer wallets (`name@tpay`). Also the only participant with a mint. */
const tpay: Participant = {
  id: "tpay",
  valAdd(t, handle) {
    const user = userByHandle(t, handle);
    return user ? { ok: true, name: user.name } : { ok: false, code: "HANDLE_NOT_FOUND" };
  },
  debit(t, txn) {
    return once(t, "tpay", txn.txn_id, "Debit", () => {
      const payer = userByHandle(t, txn.payer_handle);
      const account = getAccount(t, txn.payer_account);
      if (!payer) throw new TpiError("HANDLE_NOT_FOUND");
      if (!account || account.participant !== "tpay" || account.kind !== "wallet" || account.owner !== payer.id) throw new TpiError("UNKNOWN_ACCOUNT");
      post(t, {
        participant: "tpay",
        txnId: txn.txn_id,
        kind: "debit",
        lines: [
          { account: account.id, amount: -txn.amount },
          { account: systemAccount("tpay", "clearing"), amount: txn.amount },
        ],
      });
      insertActivity(t, {
        userId: payer.id,
        accountId: account.id,
        direction: "debit",
        amount: txn.amount,
        method: txn.method,
        status: "pending",
        counterpartyName: txn.payee_name ?? txn.payee_handle,
        counterpartyHandle: txn.payee_handle,
        counterpartyId: contactIdFor(t, txn.payee_handle),
        note: txn.note,
        txnId: txn.txn_id,
        rrn: txn.rrn,
      });
      touch(t, payer.id);
    });
  },
  credit(t, txn) {
    return once(t, "tpay", txn.txn_id, "Credit", () => {
      const payee = userByHandle(t, txn.payee_handle);
      if (!payee) throw new TpiError("HANDLE_NOT_FOUND");
      const account = primaryWallet(t, payee.id);
      post(t, {
        participant: "tpay",
        txnId: txn.txn_id,
        kind: "credit",
        lines: [
          { account: systemAccount("tpay", "clearing"), amount: -txn.amount },
          { account: account.id, amount: txn.amount },
        ],
      });
      insertActivity(t, {
        userId: payee.id,
        accountId: account.id,
        direction: "credit",
        amount: txn.amount,
        method: txn.method,
        status: "success",
        counterpartyName: txn.payer_name,
        counterpartyHandle: txn.payer_handle,
        counterpartyId: contactIdFor(t, txn.payer_handle),
        note: txn.note,
        txnId: txn.txn_id,
        rrn: txn.rrn,
      });
      touch(t, payee.id);
    });
  },
  reversal(t, txn) {
    return once(t, "tpay", txn.txn_id, "Reversal", () => {
      const debit = sql(t, "SELECT id FROM journals WHERE participant = 'tpay' AND txn_id = ? AND kind = 'debit'").get(txn.txn_id) as
        | { id: string }
        | undefined;
      if (!debit) return; // Nothing was taken, so there is nothing to give back.
      const lines = sql(t, "SELECT account_id AS account, amount FROM postings WHERE journal_id = ?").all(debit.id) as { account: string; amount: number }[];
      post(t, { participant: "tpay", txnId: txn.txn_id, kind: "reversal", lines: lines.map((l) => ({ account: l.account, amount: -l.amount })), ignoreCap: true });
      sql(t, "UPDATE activity SET status = 'reversed' WHERE txn_id = ? AND direction = 'debit'").run(txn.txn_id);
      const payer = userByHandle(t, txn.payer_handle);
      if (payer) touch(t, payer.id);
    });
  },
  final(t, txn) {
    return once(t, "tpay", txn.txn_id, "Final", () => {
      const payer = txn.payer_pid === "tpay" ? userByHandle(t, txn.payer_handle) : undefined;
      if (payer && txn.state === "SUCCESS") {
        sql(t, "UPDATE activity SET status = 'success' WHERE txn_id = ? AND user_id = ? AND direction = 'debit'").run(txn.txn_id, payer.id);
        // The `tr`-style reference tells the app exactly what this payment settled.
        if (txn.ref_type === "request") sql(t, "UPDATE messages SET status = 'paid' WHERE id = ? AND status = 'pending'").run(txn.ref_id);
        if (txn.ref_type === "bill") sql(t, "UPDATE linked_bills SET due_amount = 0 WHERE id = ? AND user_id = ?").run(txn.ref_id, payer.id);
        maybeReward(t, payer.id, txn);
      }
      if (payer) touch(t, payer.id);
      const payee = txn.payee_pid === "tpay" ? userByHandle(t, txn.payee_handle) : undefined;
      if (payee) touch(t, payee.id);
    });
  },
};

/** Tacket: shops, billers and recharge operators (`shop@tacket`). They only receive in this demo. */
const tacket: Participant = {
  id: "tacket",
  valAdd(t, handle) {
    const shop = merchantByHandle(t, handle);
    if (!shop) return { ok: false, code: "HANDLE_NOT_FOUND" };
    return shop.active ? { ok: true, name: shop.name } : { ok: false, code: "HANDLE_BLOCKED" };
  },
  debit(t, txn) {
    return once(t, "tacket", txn.txn_id, "Debit", () => {
      throw new TpiError("NOT_SUPPORTED");
    });
  },
  credit(t, txn) {
    return once(t, "tacket", txn.txn_id, "Credit", () => {
      const shop = merchantByHandle(t, txn.payee_handle);
      if (!shop) throw new TpiError("HANDLE_NOT_FOUND");
      if (!shop.active) throw new TpiError("HANDLE_BLOCKED");
      post(t, {
        participant: "tacket",
        txnId: txn.txn_id,
        kind: "credit",
        lines: [
          { account: systemAccount("tacket", "clearing"), amount: -txn.amount },
          { account: `tacket:m:${shop.id}`, amount: txn.amount },
        ],
      });
    });
  },
  reversal(t, txn) {
    return once(t, "tacket", txn.txn_id, "Reversal", () => {});
  },
  final(t, txn) {
    return once(t, "tacket", txn.txn_id, "Final", () => {});
  },
};

/** Demo Bank Network: any made-up bank account, reached by bank transfer. Accounts open on first credit. */
const demobank: Participant = {
  id: "demobank",
  valAdd(_t, handle, hint) {
    if (!BANK_HANDLE_RE.test(handle)) return { ok: false, code: "HANDLE_NOT_FOUND" };
    return { ok: true, name: hint?.trim().slice(0, 40) || "Account holder" };
  },
  debit(t, txn) {
    return once(t, "demobank", txn.txn_id, "Debit", () => {
      throw new TpiError("NOT_SUPPORTED");
    });
  },
  credit(t, txn) {
    return once(t, "demobank", txn.txn_id, "Credit", () => {
      const id = `demobank:${txn.payee_handle}`;
      sql(t, "INSERT OR IGNORE INTO ledger_accounts (id, participant, kind, owner, created_at) VALUES (?, 'demobank', 'external', ?, ?)").run(
        id,
        txn.payee_handle,
        t.now(),
      );
      post(t, {
        participant: "demobank",
        txnId: txn.txn_id,
        kind: "credit",
        lines: [
          { account: systemAccount("demobank", "clearing"), amount: -txn.amount },
          { account: id, amount: txn.amount },
        ],
      });
    });
  },
  reversal(t, txn) {
    return once(t, "demobank", txn.txn_id, "Reversal", () => {});
  },
  final(t, txn) {
    return once(t, "demobank", txn.txn_id, "Final", () => {});
  },
};

export const PARTICIPANT_IMPL: Record<ParticipantId, Participant> = { tpay, tacket, demobank };

/** The switch's directory: the part after `@` says which participant owns a handle. */
export function participantFor(handle: string): Participant | undefined {
  const pid = participantOf(handle);
  return pid ? PARTICIPANT_IMPL[pid] : undefined;
}
