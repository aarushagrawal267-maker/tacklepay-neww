// The TPI switch: TacketPay's stand-in for NPCI. It owns no balances, only the transaction log.
// Each step is written down before the next participant is called, and every participant call is
// idempotent, so a payment interrupted at any point can be driven forward again by `resume`.
import { FINAL_STATES, participantOf, type ParticipantId, type TpiErrorCode, type TxnState } from "@/lib/tpi";
import type { TxMethod } from "@/lib/types";
import { MAX_PAYMENT_PAISE } from "@/lib/money";
import { atomic, sql, TpiError, type Tpi } from "./db";
import { participantFor, PARTICIPANT_IMPL, type MsgResult, type Participant, type ValAddResult } from "./participants";
import type { TxnRow } from "./records";

export interface ReqPay {
  payerHandle: string;
  payerName: string;
  payerAccount: string;
  payeeHandle: string;
  /** Name typed by the payer, for participants that can't look names up (bank transfers). */
  payeeHint?: string;
  amount: number;
  note?: string;
  method: TxMethod;
  ref?: { type: "request" | "bill"; id: string };
  /** Retrying with the same key returns the first attempt instead of paying twice. */
  idemKey?: string;
}

export function getTxn(t: Tpi, txnId: string): TxnRow | undefined {
  return sql(t, "SELECT * FROM tpi_txns WHERE txn_id = ?").get(txnId) as TxnRow | undefined;
}

function move(t: Tpi, txn: TxnRow, to: TxnState, msg: string, patch: { payee_name?: string; failure_code?: TpiErrorCode } = {}): TxnRow {
  atomic(t, () => {
    const res = sql(
      t,
      `UPDATE tpi_txns SET state = ?, updated_at = ?, payee_name = COALESCE(?, payee_name), failure_code = COALESCE(?, failure_code)
       WHERE txn_id = ? AND state = ?`,
    ).run(to, t.now(), patch.payee_name ?? null, patch.failure_code ?? null, txn.txn_id, txn.state);
    if (res.changes !== 1) throw new TpiError("INTERNAL", 500);
    sql(t, "INSERT INTO tpi_events (txn_id, from_state, to_state, msg, at) VALUES (?, ?, ?, ?, ?)").run(txn.txn_id, txn.state, to, msg, t.now());
  });
  return getTxn(t, txn.txn_id)!;
}

/** ReqPay: the payer's participant asks the switch to move money. Returns the transaction in a final state. */
export function reqPay(t: Tpi, req: ReqPay): TxnRow {
  if (req.idemKey) {
    const seen = sql(t, "SELECT * FROM tpi_txns WHERE idem_key = ?").get(req.idemKey) as TxnRow | undefined;
    if (seen) {
      // Same key, different payment: refuse rather than report the first payment as this one.
      const same =
        seen.payer_handle === req.payerHandle &&
        seen.payer_account === req.payerAccount &&
        seen.payee_handle === req.payeeHandle &&
        seen.amount === req.amount &&
        seen.ref_type === (req.ref?.type ?? null) &&
        seen.ref_id === (req.ref?.id ?? null);
      if (!same) throw new TpiError("IDEMPOTENCY_MISMATCH", 409);
      return resume(t, seen.txn_id);
    }
  }
  if (!Number.isSafeInteger(req.amount) || req.amount <= 0) throw new TpiError("INVALID_AMOUNT");
  if (req.amount > MAX_PAYMENT_PAISE) throw new TpiError("AMOUNT_TOO_LARGE");
  const payerPid = participantOf(req.payerHandle);
  if (!payerPid) throw new TpiError("HANDLE_NOT_FOUND");
  if (req.payerHandle === req.payeeHandle) throw new TpiError("SELF_PAYMENT");

  const txnId = `TPI${t.id().toUpperCase()}`;
  atomic(t, () => {
    sql(
      t,
      `INSERT INTO tpi_txns (txn_id, rrn, payer_handle, payer_name, payer_pid, payer_account, payee_handle, payee_hint, payee_pid,
         amount, note, method, ref_type, ref_id, state, idem_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INITIATED', ?, ?, ?)`,
    ).run(
      txnId,
      t.rrn(),
      req.payerHandle,
      req.payerName,
      payerPid,
      req.payerAccount,
      req.payeeHandle,
      req.payeeHint ?? null,
      participantOf(req.payeeHandle),
      req.amount,
      req.note ?? null,
      req.method,
      req.ref?.type ?? null,
      req.ref?.id ?? null,
      req.idemKey ?? null,
      t.now(),
      t.now(),
    );
    sql(t, "INSERT INTO tpi_events (txn_id, from_state, to_state, msg, at) VALUES (?, NULL, 'INITIATED', 'ReqPay', ?)").run(txnId, t.now());
  });
  return resume(t, txnId);
}

/** Drives a transaction from wherever it stopped to a final state, then tells both sides. */
export function resume(t: Tpi, txnId: string): TxnRow {
  const found = getTxn(t, txnId);
  if (!found) throw new TpiError("NOT_FOUND", 404);
  let txn: TxnRow = found;
  const payer = PARTICIPANT_IMPL[txn.payer_pid];
  for (;;) {
    const payee: Participant | undefined = txn.payee_pid ? PARTICIPANT_IMPL[txn.payee_pid] : undefined;
    switch (txn.state) {
      case "INITIATED": {
        const v: ValAddResult = payee ? payee.valAdd(t, txn.payee_handle, txn.payee_hint) : { ok: false, code: "HANDLE_NOT_FOUND" };
        txn = v.ok
          ? move(t, txn, "VALIDATED", `ValAdd ${txn.payee_handle}: ${v.name}`, { payee_name: v.name })
          : move(t, txn, "FAILED", `ValAdd ${txn.payee_handle}: ${v.code}`, { failure_code: v.code });
        break;
      }
      case "VALIDATED":
        txn = move(t, txn, "DEBIT_PENDING", `Debit → ${txn.payer_pid}`);
        break;
      case "DEBIT_PENDING": {
        const d: MsgResult = payer.debit(t, txn);
        txn = d.ok ? move(t, txn, "DEBITED", "Debited") : move(t, txn, "FAILED", `Debit failed: ${d.code}`, { failure_code: d.code });
        break;
      }
      case "DEBITED":
        txn = move(t, txn, "CREDIT_PENDING", `Credit → ${txn.payee_pid}`);
        break;
      case "CREDIT_PENDING": {
        const c: MsgResult = payee!.credit(t, txn);
        txn = c.ok
          ? move(t, txn, "SUCCESS", "Credited")
          : move(t, txn, "REVERSAL_PENDING", `Credit failed: ${c.code}`, { failure_code: c.code });
        break;
      }
      case "REVERSAL_PENDING": {
        const r: MsgResult = payer.reversal(t, txn);
        // A reversal for a known debit always succeeds; if it somehow didn't, stay pending for the next resume.
        if (!r.ok) return txn;
        txn = move(t, txn, "REVERSED", "Reversal → payer");
        break;
      }
      default: {
        // SUCCESS, REVERSED or FAILED: send Final to each participant involved (idempotent).
        const pids = new Set<ParticipantId>([txn.payer_pid, ...(txn.payee_pid ? [txn.payee_pid] : [])]);
        for (const pid of pids) PARTICIPANT_IMPL[pid].final(t, txn);
        return txn;
      }
    }
  }
}

/** Finishes anything a crash or restart left half-done. Runs when the database is opened. */
export function resumePending(t: Tpi): number {
  const open = sql(t, `SELECT txn_id FROM tpi_txns WHERE state NOT IN (${FINAL_STATES.map(() => "?").join(", ")})`).all(...FINAL_STATES) as {
    txn_id: string;
  }[];
  for (const { txn_id } of open) resume(t, txn_id);
  return open.length;
}

/** ValAdd for the app: "Mehta Store ✓" before paying. */
export function validateHandle(t: Tpi, handle: string, hint: string | null = null) {
  const p = participantFor(handle);
  if (!p) return { ok: false as const, code: "HANDLE_NOT_FOUND" as const };
  return p.valAdd(t, handle, hint);
}
