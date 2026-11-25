// TPI — Tacket Payment Interface. A UPI-shaped network for demo money.
// This file is shared by the server (switch + participants) and the app: handle rules,
// error codes, transaction states and the JSON shapes the app API sends back.

import type { Account, Card, Contact, LinkedBill, Message, Reward, Transaction } from "./types";

/** Each participant owns the handles ending in its suffix, like a bank owns `@okaxis`. */
export const PARTICIPANTS = {
  tpay: { name: "TacketPay", role: "Customer wallets" },
  tacket: { name: "Tacket", role: "Shops, billers and operators" },
  demobank: { name: "Demo Bank Network", role: "Bank accounts outside TacketPay" },
} as const;

export type ParticipantId = keyof typeof PARTICIPANTS;

const HANDLE_RE = /^[a-z0-9._-]{2,40}@(tpay|tacket|demobank)$/;

export function isTpiHandle(value: string): boolean {
  return HANDLE_RE.test(value);
}

export function participantOf(handle: string): ParticipantId | null {
  const m = HANDLE_RE.exec(handle);
  return m ? (m[1] as ParticipantId) : null;
}

/** Contact id for an account outside TacketPay (bank transfers). Same on server and app. */
export function externalContactId(handle: string): string {
  return `x-${handle.replace(/[^a-z0-9]+/g, "-")}`;
}

/** Bank-transfer handles carry the made-up account number and IFSC: `ac123456789.abcd0123456@demobank`. */
export function bankHandle(account: string, ifsc: string): string {
  return `ac${account}.${ifsc.toLowerCase()}@demobank`;
}

export const BANK_HANDLE_RE = /^ac(\d{9,18})\.([a-z]{4}0[a-z0-9]{6})@demobank$/;

/**
 * Switch states, as in the plan:
 * INITIATED → VALIDATED → DEBIT_PENDING → DEBITED → CREDIT_PENDING → SUCCESS
 * with FAILED before any debit, and REVERSAL_PENDING → REVERSED when a credit fails after the debit.
 */
export type TxnState =
  | "INITIATED"
  | "VALIDATED"
  | "DEBIT_PENDING"
  | "DEBITED"
  | "CREDIT_PENDING"
  | "SUCCESS"
  | "REVERSAL_PENDING"
  | "REVERSED"
  | "FAILED";

export const FINAL_STATES: readonly TxnState[] = ["SUCCESS", "REVERSED", "FAILED"];

export type TpiErrorCode =
  | "OFFLINE"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL"
  | "NAME_REQUIRED"
  | "PHONE_INVALID"
  | "PHONE_TAKEN"
  | "PIN_FORMAT"
  | "PIN_MISMATCH"
  | "ACCOUNT_NOT_FOUND"
  | "PIN_INVALID"
  | "PIN_LOCKED"
  | "INVALID_AMOUNT"
  | "AMOUNT_TOO_LARGE"
  | "INSUFFICIENT_FUNDS"
  | "LIMIT_EXCEEDED"
  | "TOPUP_LIMIT"
  | "UNKNOWN_ACCOUNT"
  | "HANDLE_NOT_FOUND"
  | "HANDLE_BLOCKED"
  | "SELF_PAYMENT"
  | "NOT_SUPPORTED"
  | "REQUEST_NOT_PAYABLE"
  | "AMOUNT_MISMATCH"
  | "IDEMPOTENCY_MISMATCH"
  | "RECON_MISMATCH"
  | "NOTHING_TO_SETTLE";

export const TPI_ERROR_COPY: Record<TpiErrorCode, string> = {
  OFFLINE: "Can't reach the TPI server. Check your connection and try again",
  BAD_REQUEST: "Something in that request was missing or malformed",
  UNAUTHORIZED: "Sign in to TacketPay first",
  NOT_FOUND: "We couldn't find that",
  INTERNAL: "TPI hit a snag. Try again in a moment",
  NAME_REQUIRED: "Enter a name so friends know who's paying",
  PHONE_INVALID: "Enter a 10-digit mobile number starting with 6, 7, 8 or 9",
  PHONE_TAKEN: "This number already has a TacketPay account. Sign in instead",
  PIN_FORMAT: "Your demo PIN is exactly 4 digits",
  PIN_MISMATCH: "The two PINs don't match",
  ACCOUNT_NOT_FOUND: "No TacketPay account uses this number. Create one instead",
  PIN_INVALID: "Wrong demo PIN",
  PIN_LOCKED: "Too many wrong PINs. Try again in 5 minutes",
  INVALID_AMOUNT: "Enter an amount greater than ₹0",
  AMOUNT_TOO_LARGE: "Demo payments are limited to ₹1,00,000",
  INSUFFICIENT_FUNDS: "Not enough demo money in this account",
  LIMIT_EXCEEDED: "Demo balances top out at ₹10,00,000",
  TOPUP_LIMIT: "You can add up to ₹2,00,000 of demo money in 24 hours. Try a smaller amount or come back tomorrow",
  UNKNOWN_ACCOUNT: "Choose one of your demo accounts",
  HANDLE_NOT_FOUND: "No one on TPI has that ID",
  HANDLE_BLOCKED: "That ID isn't accepting payments right now",
  SELF_PAYMENT: "You can't pay yourself. Use Self transfer to move money between your accounts",
  NOT_SUPPORTED: "That isn't supported on TPI yet",
  REQUEST_NOT_PAYABLE: "This request was already paid, declined or cancelled",
  AMOUNT_MISMATCH: "The amount doesn't match the request",
  IDEMPOTENCY_MISMATCH: "This payment attempt was already used for different details. Start the payment again",
  RECON_MISMATCH: "Settlement refused: a participant's books don't match the switch. See the reconciliation exceptions",
  NOTHING_TO_SETTLE: "Every finished payment is already settled",
};

/** Everything the app shows for the signed-in person, rebuilt from the server's books. */
export interface Snapshot {
  rev: string;
  me: { id: string; name: string; handle: string; phone: string; referralCode: string };
  accounts: Account[];
  cards: Card[];
  contacts: Contact[];
  messages: Message[];
  transactions: Transaction[];
  rewards: Reward[];
  linkedBills: LinkedBill[];
}

export interface TxnView {
  txnId: string;
  rrn: string;
  state: TxnState;
  failureCode: TpiErrorCode | null;
  amount: number;
  payerHandle: string;
  payerName: string;
  payeeHandle: string;
  payeeName: string | null;
  payerPid: ParticipantId;
  payeePid: ParticipantId | null;
  method: string;
  note: string | null;
  createdAt: number;
  events: { state: TxnState; msg: string; at: number }[];
}

/** A payment whose switch record and participant books disagree (plan §7, recon). */
export interface ReconException {
  txnId: string;
  rrn: string;
  state: TxnState;
  participant: ParticipantId;
  problem: string;
}

export interface SettlementCycleView {
  id: number;
  openedAt: number;
  closedAt: number;
  txnCount: number;
  /** Sum of the successful payments settled in this cycle, in paise. */
  gross: number;
  trigger: "manual" | "timer";
  /** Net position per participant: positive means the network paid it, negative means it paid the network. */
  positions: { participant: ParticipantId; net: number; txnCount: number }[];
}

export interface SettlementView {
  /** Finished payments (SUCCESS or REVERSED) not yet in a cycle. */
  unsettled: number;
  cycles: SettlementCycleView[];
  exceptions: ReconException[];
}

export interface NetworkView {
  participants: {
    id: ParticipantId;
    name: string;
    role: string;
    accounts: number;
    holdings: number;
    clearing: number;
    /** Cumulative net settled with the network across all closed cycles. */
    settled: number;
  }[];
  totals: { minted: number; held: number; clearing: number; ledgerSum: number };
  counts: { users: number; success: number; reversed: number; failed: number };
  txns: TxnView[];
  settlement: SettlementView;
}
