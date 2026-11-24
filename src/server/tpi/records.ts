// Row types and lookups shared by the participants, the switch and the app service.
import { externalContactId, participantOf, type ParticipantId, type TpiErrorCode, type TxnState } from "@/lib/tpi";
import type { TxMethod, TxStatus } from "@/lib/types";
import { sql, TpiError, type Tpi } from "./db";
import type { LedgerAccount } from "./ledger";

export interface UserRow {
  id: string;
  name: string;
  phone: string;
  handle: string;
  color: string;
  pin_hash: string;
  pin_salt: string;
  pin_fails: number;
  pin_locked_until: number;
  referral_code: string;
  rev: number;
  created_at: number;
}

export interface MerchantRow {
  id: string;
  handle: string;
  name: string;
  kind: "business" | "biller";
  icon: string | null;
  color: string;
  subtitle: string | null;
  active: number;
}

export interface TxnRow {
  txn_id: string;
  rrn: string;
  payer_handle: string;
  payer_name: string;
  payer_pid: ParticipantId;
  payer_account: string;
  payee_handle: string;
  payee_hint: string | null;
  payee_name: string | null;
  payee_pid: ParticipantId | null;
  amount: number;
  note: string | null;
  method: TxMethod;
  ref_type: "request" | "bill" | null;
  ref_id: string | null;
  state: TxnState;
  failure_code: TpiErrorCode | null;
  idem_key: string | null;
  created_at: number;
  updated_at: number;
}

export function userById(t: Tpi, id: string): UserRow | undefined {
  return sql(t, "SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function userByHandle(t: Tpi, handle: string): UserRow | undefined {
  return sql(t, "SELECT * FROM users WHERE handle = ?").get(handle) as UserRow | undefined;
}

export function merchantByHandle(t: Tpi, handle: string): MerchantRow | undefined {
  return sql(t, "SELECT * FROM merchants WHERE handle = ?").get(handle) as MerchantRow | undefined;
}

export function walletsOf(t: Tpi, userId: string): LedgerAccount[] {
  return sql(t, "SELECT * FROM ledger_accounts WHERE participant = 'tpay' AND kind = 'wallet' AND owner = ? ORDER BY created_at, id").all(
    userId,
  ) as unknown as LedgerAccount[];
}

export function primaryWallet(t: Tpi, userId: string): LedgerAccount {
  const wallets = walletsOf(t, userId);
  const wallet = wallets.find((w) => w.is_primary) ?? wallets[0];
  if (!wallet) throw new TpiError("UNKNOWN_ACCOUNT");
  return wallet;
}

/** The id the app uses for whoever owns `handle`, so chats and receipts line up on both phones. */
export function contactIdFor(t: Tpi, handle: string): string | null {
  switch (participantOf(handle)) {
    case "tpay": {
      const user = userByHandle(t, handle);
      return user ? `u-${user.id}` : null;
    }
    case "tacket":
      return merchantByHandle(t, handle)?.id ?? null;
    case "demobank":
      return externalContactId(handle);
    default:
      return null;
  }
}

export function insertActivity(
  t: Tpi,
  a: {
    userId: string;
    accountId: string;
    direction: "debit" | "credit";
    amount: number;
    method: TxMethod;
    status: TxStatus;
    counterpartyName: string;
    counterpartyHandle: string;
    counterpartyId?: string | null;
    note?: string | null;
    txnId?: string;
    rrn: string;
  },
): string {
  const id = `a${t.id()}`;
  sql(
    t,
    `INSERT INTO activity (id, user_id, account_id, direction, amount, method, status, counterparty_name, counterparty_handle,
       counterparty_id, note, txn_id, rrn, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    a.userId,
    a.accountId,
    a.direction,
    a.amount,
    a.method,
    a.status,
    a.counterpartyName,
    a.counterpartyHandle,
    a.counterpartyId ?? null,
    a.note ?? null,
    a.txnId ?? null,
    a.rrn,
    t.now(),
  );
  return id;
}
