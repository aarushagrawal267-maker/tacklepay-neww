import type { IconName } from "@/components/ui/icon-paths";

export type ContactKind = "person" | "business" | "biller" | "bank";

export interface Contact {
  id: string;
  name: string;
  handle: string;
  kind: ContactKind;
  phone?: string;
  /** Avatar background. Letter avatars only — no real faces or brand logos. */
  color: string;
  icon?: IconName;
  subtitle?: string;
}

export interface Account {
  id: string;
  bank: string;
  last4: string;
  type: "Savings account" | "Current account";
  balance: number; // paise
  primary: boolean;
}

export interface Card {
  id: string;
  label: string;
  last4: string;
}

interface MessageBase {
  id: string;
  contactId: string;
  from: "me" | "them";
  at: number;
}

export type Message =
  | (MessageBase & { type: "text"; text: string })
  | (MessageBase & { type: "payment"; txId: string })
  | (MessageBase & { type: "request"; amount: number; note?: string; status: "pending" | "paid" | "declined" | "cancelled" });

export type TxMethod =
  | "contact"
  | "qr"
  | "phone"
  | "bank"
  | "bill"
  | "recharge"
  | "reward"
  | "self"
  | "topup"
  | "welcome";

/** success: settled. pending: debited, credit in flight. reversed: the credit failed and the debit was undone. */
export type TxStatus = "success" | "pending" | "reversed";

export interface Transaction {
  id: string;
  ref: string;
  direction: "debit" | "credit";
  amount: number; // paise, always positive
  contactId?: string;
  counterpartyName: string;
  counterpartyHandle: string;
  note?: string;
  method: TxMethod;
  accountId: string;
  at: number;
  status: TxStatus;
  /** The TPI switch's id for payments that went over the network. */
  txnId?: string;
}

export interface Reward {
  id: string;
  /** null = "Better luck next time". */
  amount: number | null;
  scratched: boolean;
  reason: string;
  at: number;
}

export interface LinkedBill {
  id: string;
  categoryId: string;
  providerId: string;
  providerName: string;
  accountNumber: string;
  label?: string;
  dueAmount: number;
}

export type ThemePref = "system" | "light" | "dark";

/**
 * What the app renders. Everything except `theme` is a copy of the server's books (see `Snapshot`),
 * cached on the device so screens paint instantly and refreshed from TPI in the background.
 */
export interface State {
  version: 2;
  /** Signed in to a TacketPay account. */
  onboarded: boolean;
  /** Server revision of this copy; the sync loop sends it to ask "anything new?". */
  rev: string;
  profile: { name: string; handle: string; phone: string };
  referralCode: string;
  accounts: Account[];
  cards: Card[];
  contacts: Contact[];
  messages: Message[];
  transactions: Transaction[];
  rewards: Reward[];
  linkedBills: LinkedBill[];
  theme: ThemePref;
}
