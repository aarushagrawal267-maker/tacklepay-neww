// The TacketPay app's backend: what each screen asks for, on top of the TacketPay participant
// and the TPI switch. Every function takes the signed-in user; nothing here trusts the phone's numbers.
import type { IconName } from "@/components/ui/icon-paths";
import { MAX_BALANCE_PAISE, MAX_PAYMENT_PAISE } from "@/lib/money";
import { BILL_CATEGORIES, DEMO_BANK } from "@/lib/seed";
import { BANK_HANDLE_RE, externalContactId, participantOf, type Snapshot } from "@/lib/tpi";
import type { Contact, Message, Transaction, TxMethod, TxStatus } from "@/lib/types";
import { atomic, sql, touch, TpiError, type Tpi } from "./db";
import { formatPhone, normalizePhone, verifyPin } from "./identity";
import { openAccount, post, systemAccount } from "./ledger";
import {
  contactIdFor,
  insertActivity,
  merchantByHandle,
  primaryWallet,
  userByHandle,
  walletsOf,
  type MerchantRow,
  type TxnRow,
  type UserRow,
} from "./records";
import { reqPay, validateHandle } from "./switch";

const PAY_METHODS: TxMethod[] = ["contact", "qr", "phone", "bank", "bill", "recharge"];
const MAX_EXTRA = 5;

function amountOrThrow(amount: unknown): number {
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) throw new TpiError("INVALID_AMOUNT");
  if (amount > MAX_PAYMENT_PAISE) throw new TpiError("AMOUNT_TOO_LARGE");
  return amount;
}

function ownWallet(t: Tpi, user: UserRow, accountId: string | undefined) {
  if (!accountId) return primaryWallet(t, user.id);
  const wallet = walletsOf(t, user.id).find((w) => w.id === accountId);
  if (!wallet) throw new TpiError("UNKNOWN_ACCOUNT");
  return wallet;
}

const clean = (text: string | undefined, max: number) => text?.trim().replace(/\s+/g, " ").slice(0, max) || undefined;

export function pay(
  t: Tpi,
  user: UserRow,
  input: {
    payeeHandle: string;
    payeeName?: string;
    amount: number;
    note?: string;
    method: TxMethod;
    accountId?: string;
    pin: string;
    requestId?: string;
    billId?: string;
    idemKey?: string;
  },
): { txn: TxnRow; activityId: string | null } {
  verifyPin(t, user, input.pin);
  const amount = amountOrThrow(input.amount);
  const wallet = ownWallet(t, user, input.accountId);
  const method = PAY_METHODS.includes(input.method) ? input.method : "contact";

  let ref: { type: "request" | "bill"; id: string } | undefined;
  if (input.requestId) {
    const req = sql(t, "SELECT * FROM messages WHERE id = ? AND kind = 'request'").get(input.requestId) as
      | { to_handle: string; from_handle: string; amount: number; status: string }
      | undefined;
    if (!req || req.to_handle !== user.handle || req.from_handle !== input.payeeHandle || req.status !== "pending") {
      throw new TpiError("REQUEST_NOT_PAYABLE");
    }
    if (req.amount !== amount) throw new TpiError("AMOUNT_MISMATCH");
    ref = { type: "request", id: input.requestId };
  } else if (input.billId) {
    const bill = sql(t, "SELECT due_amount FROM linked_bills WHERE id = ? AND user_id = ?").get(input.billId, user.id) as
      | { due_amount: number }
      | undefined;
    if (!bill || bill.due_amount === 0) throw new TpiError("REQUEST_NOT_PAYABLE");
    if (bill.due_amount !== amount) throw new TpiError("AMOUNT_MISMATCH");
    ref = { type: "bill", id: input.billId };
  }

  const txn = reqPay(t, {
    payerHandle: user.handle,
    payerName: user.name,
    payerAccount: wallet.id,
    payeeHandle: input.payeeHandle,
    payeeHint: clean(input.payeeName, 40),
    amount,
    note: clean(input.note, 60),
    method,
    ref,
    idemKey: input.idemKey ? `${user.id}:${input.idemKey.slice(0, 64)}` : undefined,
  });
  if (txn.state === "FAILED") throw new TpiError(txn.failure_code ?? "INTERNAL");
  const row = sql(t, "SELECT id FROM activity WHERE txn_id = ? AND user_id = ? AND direction = 'debit'").get(txn.txn_id, user.id) as
    | { id: string }
    | undefined;
  return { txn, activityId: row?.id ?? null };
}

/** "Add money" from the user's demo bank: the only place, besides sign-up and rewards, where the mint creates money. */
export function topUp(t: Tpi, user: UserRow, input: { amount: number; accountId?: string; pin: string }): string {
  verifyPin(t, user, input.pin);
  const amount = amountOrThrow(input.amount);
  const wallet = ownWallet(t, user, input.accountId);
  return atomic(t, () => {
    post(t, {
      participant: "tpay",
      kind: "topup",
      lines: [
        { account: systemAccount("tpay", "mint"), amount: -amount },
        { account: wallet.id, amount },
      ],
    });
    const id = insertActivity(t, {
      userId: user.id,
      accountId: wallet.id,
      direction: "credit",
      amount,
      method: "topup",
      status: "success",
      counterpartyName: "Added from bank",
      counterpartyHandle: `${wallet.bank} ${wallet.last4}`,
      note: "Demo top-up — not real money",
      rrn: t.rrn(),
    });
    touch(t, user.id);
    return id;
  });
}

export function selfTransfer(t: Tpi, user: UserRow, input: { fromId: string; toId: string; amount: number; pin: string }): string {
  verifyPin(t, user, input.pin);
  const amount = amountOrThrow(input.amount);
  const from = ownWallet(t, user, input.fromId);
  const to = ownWallet(t, user, input.toId);
  if (from.id === to.id) throw new TpiError("UNKNOWN_ACCOUNT");
  return atomic(t, () => {
    post(t, {
      participant: "tpay",
      kind: "self",
      lines: [
        { account: from.id, amount: -amount },
        { account: to.id, amount },
      ],
    });
    const id = insertActivity(t, {
      userId: user.id,
      accountId: from.id,
      direction: "debit",
      amount,
      method: "self",
      status: "success",
      counterpartyName: `${to.bank} ${to.last4}`,
      counterpartyHandle: user.handle,
      note: "Self transfer",
      rrn: t.rrn(),
    });
    touch(t, user.id);
    return id;
  });
}

/** A collect request: asks another TacketPay user to pay. It shows up in their chat with Pay and Decline. */
export function requestMoney(t: Tpi, user: UserRow, input: { fromHandle: string; amount: number; note?: string }): string {
  const amount = amountOrThrow(input.amount);
  if (input.fromHandle === user.handle) throw new TpiError("SELF_PAYMENT");
  if (participantOf(input.fromHandle) !== "tpay") throw new TpiError("NOT_SUPPORTED");
  const payer = userByHandle(t, input.fromHandle);
  if (!payer) throw new TpiError("HANDLE_NOT_FOUND");
  return atomic(t, () => {
    const id = `m${t.id()}`;
    sql(t, "INSERT INTO messages (id, from_handle, to_handle, kind, amount, note, status, at) VALUES (?, ?, ?, 'request', ?, ?, 'pending', ?)").run(
      id,
      user.handle,
      payer.handle,
      amount,
      clean(input.note, 60) ?? null,
      t.now(),
    );
    touch(t, user.id);
    touch(t, payer.id);
    return id;
  });
}

/** The payer declines, or the person who asked cancels. */
export function respondRequest(t: Tpi, user: UserRow, input: { messageId: string; action: "decline" | "cancel" }) {
  const msg = sql(t, "SELECT * FROM messages WHERE id = ? AND kind = 'request'").get(input.messageId) as
    | { from_handle: string; to_handle: string; status: string }
    | undefined;
  const allowed = input.action === "cancel" ? msg?.from_handle === user.handle : msg?.to_handle === user.handle;
  if (!msg || !allowed) throw new TpiError("NOT_FOUND", 404);
  if (msg.status !== "pending") throw new TpiError("REQUEST_NOT_PAYABLE");
  atomic(t, () => {
    sql(t, "UPDATE messages SET status = ? WHERE id = ?").run(input.action === "cancel" ? "cancelled" : "declined", input.messageId);
    for (const handle of [msg.from_handle, msg.to_handle]) {
      const u = userByHandle(t, handle);
      if (u) touch(t, u.id);
    }
  });
}

export function sendMessage(t: Tpi, user: UserRow, input: { toHandle: string; text: string }) {
  const text = input.text?.trim().slice(0, 500);
  if (!text) throw new TpiError("BAD_REQUEST");
  if (input.toHandle === user.handle) throw new TpiError("SELF_PAYMENT");
  const to = userByHandle(t, input.toHandle);
  if (!to && !merchantByHandle(t, input.toHandle)) throw new TpiError("HANDLE_NOT_FOUND");
  atomic(t, () => {
    sql(t, "INSERT INTO messages (id, from_handle, to_handle, kind, text, at) VALUES (?, ?, ?, 'text', ?, ?)").run(
      `m${t.id()}`,
      user.handle,
      input.toHandle,
      text,
      t.now(),
    );
    touch(t, user.id);
    if (to) touch(t, to.id);
  });
}

export function scratchReward(t: Tpi, user: UserRow, rewardId: string) {
  const reward = sql(t, "SELECT * FROM rewards WHERE id = ? AND user_id = ?").get(rewardId, user.id) as
    | { amount: number | null; scratched: number; reason: string }
    | undefined;
  if (!reward) throw new TpiError("NOT_FOUND", 404);
  if (reward.scratched) return;
  atomic(t, () => {
    sql(t, "UPDATE rewards SET scratched = 1 WHERE id = ?").run(rewardId);
    if (reward.amount) {
      const wallet = primaryWallet(t, user.id);
      post(t, {
        participant: "tpay",
        kind: "reward",
        lines: [
          { account: systemAccount("tpay", "mint"), amount: -reward.amount },
          { account: wallet.id, amount: reward.amount },
        ],
      });
      insertActivity(t, {
        userId: user.id,
        accountId: wallet.id,
        direction: "credit",
        amount: reward.amount,
        method: "reward",
        status: "success",
        counterpartyName: "TacketPay rewards",
        counterpartyHandle: "rewards@tpay",
        note: reward.reason,
        rrn: t.rrn(),
      });
    }
    touch(t, user.id);
  });
}

export function addAccount(t: Tpi, user: UserRow) {
  const wallets = walletsOf(t, user.id);
  if (wallets.length >= MAX_EXTRA) throw new TpiError("NOT_SUPPORTED");
  const odd = wallets.length % 2 === 1;
  atomic(t, () => {
    openAccount(t, {
      id: `tpay:w:${t.id()}`,
      participant: "tpay",
      kind: "wallet",
      owner: user.id,
      bank: odd ? "Play Money Bank" : DEMO_BANK,
      last4: String(1000 + Math.floor(t.random() * 9000)),
      type: odd ? "Savings account" : "Current account",
      cap: MAX_BALANCE_PAISE,
    });
    touch(t, user.id);
  });
}

export function setPrimary(t: Tpi, user: UserRow, accountId: string) {
  const wallet = ownWallet(t, user, accountId);
  atomic(t, () => {
    sql(t, "UPDATE ledger_accounts SET is_primary = (id = ?) WHERE participant = 'tpay' AND kind = 'wallet' AND owner = ?").run(wallet.id, user.id);
    touch(t, user.id);
  });
}

export function addCard(t: Tpi, user: UserRow) {
  const count = (sql(t, "SELECT COUNT(*) AS n FROM cards WHERE user_id = ?").get(user.id) as { n: number }).n;
  if (count >= MAX_EXTRA) throw new TpiError("NOT_SUPPORTED");
  atomic(t, () => {
    sql(t, "INSERT INTO cards (id, user_id, label, last4, created_at) VALUES (?, ?, 'Demo Card', ?, ?)").run(
      `c${t.id()}`,
      user.id,
      String(1000 + Math.floor(t.random() * 9000)),
      t.now(),
    );
    touch(t, user.id);
  });
}

export function linkBill(t: Tpi, user: UserRow, input: { categoryId: string; providerId: string; accountNumber: string; label?: string }): string {
  const category = BILL_CATEGORIES.find((c) => c.id === input.categoryId);
  const provider = category?.providers.find((p) => p.id === input.providerId);
  const number = input.accountNumber?.trim().toUpperCase();
  if (!provider || !/^[A-Z0-9-]{6,20}$/.test(number ?? "")) throw new TpiError("BAD_REQUEST");
  return atomic(t, () => {
    const id = `b${t.id()}`;
    sql(
      t,
      `INSERT INTO linked_bills (id, user_id, category_id, provider_id, provider_name, account_number, label, due_amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, user.id, category!.id, provider.id, provider.name, number, clean(input.label, 24) ?? null, (199 + Math.floor(t.random() * 1800)) * 100, t.now());
    touch(t, user.id);
    return id;
  });
}

export function rename(t: Tpi, user: UserRow, name: string) {
  const next = name?.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!next) throw new TpiError("NAME_REQUIRED");
  atomic(t, () => {
    sql(t, "UPDATE users SET name = ? WHERE id = ?").run(next, user.id);
    touch(t, user.id);
  });
}

function personContact(u: Pick<UserRow, "id" | "name" | "handle" | "color">): Contact {
  return { id: `u-${u.id}`, name: u.name, handle: u.handle, kind: "person", color: u.color };
}

function merchantContact(m: MerchantRow): Contact {
  return { id: m.id, name: m.name, handle: m.handle, kind: m.kind, color: m.color, icon: (m.icon as IconName | null) ?? undefined, subtitle: m.subtitle ?? undefined };
}

function bankContact(handle: string, name: string): Contact {
  const m = BANK_HANDLE_RE.exec(handle);
  return {
    id: externalContactId(handle),
    name,
    handle,
    kind: "bank",
    color: "#5f6670",
    subtitle: m ? `A/c ••${m[1].slice(-4)} · ${m[2].toUpperCase()}` : undefined,
  };
}

/** Looks up who you're about to pay (TPI's ValAdd), by ID or by phone number. */
export function resolve(t: Tpi, user: UserRow, input: { handle?: string; phone?: string; name?: string }): Contact {
  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new TpiError("PHONE_INVALID");
    const found = sql(t, "SELECT id, name, handle, color FROM users WHERE phone = ?").get(phone) as UserRow | undefined;
    if (!found) throw new TpiError("HANDLE_NOT_FOUND", 404);
    if (found.id === user.id) throw new TpiError("SELF_PAYMENT");
    return personContact(found);
  }
  const handle = input.handle?.trim().toLowerCase() ?? "";
  if (handle === user.handle) throw new TpiError("SELF_PAYMENT");
  const v = validateHandle(t, handle, input.name ?? null);
  if (!v.ok) throw new TpiError(v.code, 404);
  switch (participantOf(handle)) {
    case "tpay":
      return personContact(userByHandle(t, handle)!);
    case "tacket":
      return merchantContact(merchantByHandle(t, handle)!);
    default:
      return bankContact(handle, v.name);
  }
}

export function revOf(t: Tpi, user: UserRow): string {
  const users = (sql(t, "SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  return `${user.rev}.${users}`;
}

interface ActivityRow {
  id: string;
  account_id: string;
  direction: "debit" | "credit";
  amount: number;
  method: TxMethod;
  status: TxStatus;
  counterparty_name: string;
  counterparty_handle: string;
  counterparty_id: string | null;
  note: string | null;
  txn_id: string | null;
  rrn: string;
  at: number;
}

interface MessageRow {
  id: string;
  from_handle: string;
  to_handle: string;
  kind: "text" | "request";
  text: string | null;
  amount: number | null;
  note: string | null;
  status: "pending" | "paid" | "declined" | "cancelled" | null;
  at: number;
}

/** Everything the app shows, rebuilt from the books on every change. */
export function snapshot(t: Tpi, user: UserRow): Snapshot {
  const people = (sql(t, "SELECT id, name, handle, color FROM users WHERE id != ? ORDER BY created_at DESC LIMIT 200").all(user.id) as unknown as UserRow[]).map(
    personContact,
  );
  const shops = (sql(t, "SELECT * FROM merchants WHERE active = 1 ORDER BY rowid").all() as unknown as MerchantRow[]).map(merchantContact);
  const banks = (
    sql(t, "SELECT counterparty_handle AS handle, MAX(counterparty_name) AS name FROM activity WHERE user_id = ? AND counterparty_handle LIKE '%@demobank' GROUP BY counterparty_handle").all(
      user.id,
    ) as { handle: string; name: string }[]
  ).map((b) => bankContact(b.handle, b.name));

  const activity = sql(t, "SELECT * FROM activity WHERE user_id = ? ORDER BY at DESC, rowid DESC LIMIT 500").all(user.id) as unknown as ActivityRow[];
  const transactions = activity.map(
    (a): Transaction => ({
      id: a.id,
      ref: a.rrn,
      direction: a.direction,
      amount: a.amount,
      contactId: a.counterparty_id ?? undefined,
      counterpartyName: a.counterparty_name,
      counterpartyHandle: a.counterparty_handle,
      note: a.note ?? undefined,
      method: a.method,
      accountId: a.account_id,
      at: a.at,
      status: a.status,
      txnId: a.txn_id ?? undefined,
    }),
  );

  const contactIds = new Map<string, string | null>();
  const idFor = (handle: string) => {
    if (!contactIds.has(handle)) contactIds.set(handle, contactIdFor(t, handle));
    return contactIds.get(handle)!;
  };
  const rows = sql(t, "SELECT * FROM messages WHERE from_handle = ?1 OR to_handle = ?1 ORDER BY at, rowid").all(user.handle) as unknown as MessageRow[];
  const messages = rows.flatMap((m): Message[] => {
    const mine = m.from_handle === user.handle;
    const contactId = idFor(mine ? m.to_handle : m.from_handle);
    if (!contactId) return [];
    const base = { id: m.id, contactId, from: mine ? ("me" as const) : ("them" as const), at: m.at };
    return m.kind === "request"
      ? [{ ...base, type: "request", amount: m.amount ?? 0, note: m.note ?? undefined, status: m.status ?? "pending" }]
      : [{ ...base, type: "text", text: m.text ?? "" }];
  });

  return {
    rev: revOf(t, user),
    me: { id: user.id, name: user.name, handle: user.handle, phone: formatPhone(user.phone), referralCode: user.referral_code },
    accounts: walletsOf(t, user.id).map((w) => ({
      id: w.id,
      bank: w.bank ?? DEMO_BANK,
      last4: w.last4 ?? "0000",
      type: w.acct_type === "Current account" ? "Current account" : "Savings account",
      balance: w.balance,
      primary: !!w.is_primary,
    })),
    cards: (sql(t, "SELECT id, label, last4 FROM cards WHERE user_id = ? ORDER BY created_at").all(user.id) as { id: string; label: string; last4: string }[]).map(
      (c) => ({ ...c }),
    ),
    contacts: [...people, ...shops, ...banks],
    messages,
    transactions,
    rewards: (
      sql(t, "SELECT * FROM rewards WHERE user_id = ? ORDER BY at DESC, rowid DESC").all(user.id) as {
        id: string;
        amount: number | null;
        scratched: number;
        reason: string;
        at: number;
      }[]
    ).map((r) => ({ id: r.id, amount: r.amount, scratched: !!r.scratched, reason: r.reason, at: r.at })),
    linkedBills: (
      sql(t, "SELECT * FROM linked_bills WHERE user_id = ? ORDER BY created_at").all(user.id) as {
        id: string;
        category_id: string;
        provider_id: string;
        provider_name: string;
        account_number: string;
        label: string | null;
        due_amount: number;
      }[]
    ).map((b) => ({
      id: b.id,
      categoryId: b.category_id,
      providerId: b.provider_id,
      providerName: b.provider_name,
      accountNumber: b.account_number,
      label: b.label ?? undefined,
      dueAmount: b.due_amount,
    })),
  };
}
