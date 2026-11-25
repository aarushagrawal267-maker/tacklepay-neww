import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SQLInputValue } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_BALANCE_PAISE } from "@/lib/money";
import { billerHandle, STARTING_BALANCE } from "@/lib/seed";
import { bankHandle } from "@/lib/tpi";
import { openTpi, sql, TpiError, type Tpi } from "../db";
import { pinLockMs, signIn, signUp, userForSession, verifyPin } from "../identity";
import { ledgerSum, post, systemAccount } from "../ledger";
import { bootstrap, networkView } from "../network";
import { PARTICIPANT_IMPL } from "../participants";
import { userById, type UserRow } from "../records";
import { getTxn, resumePending } from "../switch";
import * as wallet from "../wallet";

function network(file = ":memory:"): Tpi {
  let n = 0;
  let clock = 1_800_000_000_000;
  const t = openTpi(file, {
    now: () => (clock += 1000),
    id: () => `id${String(++n).padStart(6, "0")}`,
    rrn: () => String(600000000000 + ++n),
    random: () => 0.9,
  });
  bootstrap(t);
  return t;
}

const balance = (t: Tpi, user: UserRow) => wallet.snapshot(t, userById(t, user.id)!).accounts.reduce((s, a) => s + a.balance, 0);
const fresh = (t: Tpi, user: UserRow) => userById(t, user.id)!;

/** Mints straight into a wallet up to the ₹10,00,000 cap (bypassing the daily Add money cap) to set up a refused credit. */
function fillWallet(t: Tpi, user: UserRow) {
  const account = wallet.snapshot(t, fresh(t, user)).accounts[0];
  const amount = MAX_BALANCE_PAISE - balance(t, user);
  post(t, { participant: "tpay", kind: "topup", lines: [{ account: systemAccount("tpay", "mint"), amount: -amount }, { account: account.id, amount }] });
}

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    if (err instanceof TpiError) return err.code;
    throw err;
  }
  return undefined;
}

function people(t: Tpi) {
  const diya = signUp(t, { name: "Diya", phone: "98765 43210", pin: "1234" }).user;
  const aarush = signUp(t, { name: "Aarush", phone: "+91 91234 56789", pin: "4321" }).user;
  return { diya, aarush };
}

describe("accounts", () => {
  it("opens a wallet with ₹10,000 of minted demo money and a @tpay handle", () => {
    const t = network();
    const { diya } = people(t);
    expect(diya.handle).toBe("diya@tpay");
    expect(balance(t, diya)).toBe(STARTING_BALANCE);
    expect(networkView(t).totals).toMatchObject({ minted: 2 * STARTING_BALANCE, held: 2 * STARTING_BALANCE, ledgerSum: 0 });
  });

  it("rejects a second account on the same number and signs in with phone + PIN", () => {
    const t = network();
    people(t);
    expect(code(() => signUp(t, { name: "Someone", phone: "9876543210", pin: "0000" }))).toBe("PHONE_TAKEN");
    const { user, token } = signIn(t, { phone: "9876543210", pin: "1234" });
    expect(user.name).toBe("Diya");
    expect(userForSession(t, token)?.id).toBe(user.id);
    expect(code(() => signIn(t, { phone: "9876543210", pin: "9999" }))).toBe("PIN_INVALID");
  });

  it("locks the PIN after five wrong tries", () => {
    const t = network();
    const { diya } = people(t);
    for (let i = 0; i < 4; i++) expect(code(() => verifyPin(t, fresh(t, diya), "0000"))).toBe("PIN_INVALID");
    expect(code(() => verifyPin(t, fresh(t, diya), "0000"))).toBe("PIN_LOCKED");
    expect(code(() => verifyPin(t, fresh(t, diya), "1234"))).toBe("PIN_LOCKED");
  });

  it("makes each new PIN lock twice as long, up to a day, and a correct PIN clears the count", () => {
    let clock = 1_800_000_000_000;
    let n = 0;
    const t = openTpi(":memory:", { now: () => clock, id: () => `id${String(++n).padStart(6, "0")}`, rrn: () => String(600000000000 + ++n), random: () => 0.9 });
    bootstrap(t);
    const { diya } = people(t);
    const wrongFive = () => {
      for (let i = 0; i < 4; i++) expect(code(() => signIn(t, { phone: "9876543210", pin: "0000" }))).toBe("PIN_INVALID");
      expect(code(() => signIn(t, { phone: "9876543210", pin: "0000" }))).toBe("PIN_LOCKED");
    };
    const minutes = [5, 10, 20, 40, 80, 160, 320, 640, 1280, 1440, 1440];
    for (const m of minutes) {
      wrongFive();
      clock += m * 60_000 - 1;
      // Still locked one millisecond before the lock ends, even with the right PIN.
      expect(code(() => signIn(t, { phone: "9876543210", pin: "1234" }))).toBe("PIN_LOCKED");
      clock += 1;
    }
    // At most 5 guesses a day once the lock has grown to its cap.
    expect(pinLockMs(5 * 1000)).toBe(24 * 60 * 60_000);
    expect(signIn(t, { phone: "9876543210", pin: "1234" }).user.id).toBe(diya.id);
    expect(fresh(t, diya).pin_fails).toBe(0);
    // After a correct PIN the next lock is back to five minutes.
    wrongFive();
    clock += 5 * 60_000;
    expect(signIn(t, { phone: "9876543210", pin: "1234" }).user.id).toBe(diya.id);
  });

  it("counts wrong PINs from the database, not from a user row read before the request", () => {
    const t = network();
    const { diya } = people(t);
    // Parallel requests each read the user row (pin_fails = 0) before any PIN is checked.
    const stale = fresh(t, diya);
    for (let i = 0; i < 4; i++) expect(code(() => verifyPin(t, stale, "0000"))).toBe("PIN_INVALID");
    expect(code(() => verifyPin(t, stale, "0000"))).toBe("PIN_LOCKED");
    expect(code(() => wallet.pay(t, stale, { payeeHandle: "chai.point@tacket", amount: 100, method: "qr", pin: "1234" }))).toBe("PIN_LOCKED");
    expect(balance(t, diya)).toBe(STARTING_BALANCE);
  });
});

describe("payments over TPI", () => {
  it("debits Diya, credits Aarush and records it on both sides", () => {
    const t = network();
    const { diya, aarush } = people(t);
    const { txn } = wallet.pay(t, diya, { payeeHandle: aarush.handle, amount: 250_00, note: "Movie", method: "contact", pin: "1234" });

    expect(txn.state).toBe("SUCCESS");
    expect(txn.rrn).toMatch(/^\d{12}$/);
    expect(balance(t, diya)).toBe(STARTING_BALANCE - 250_00);
    expect(balance(t, aarush)).toBe(STARTING_BALANCE + 250_00);

    const dSnap = wallet.snapshot(t, fresh(t, diya));
    const aSnap = wallet.snapshot(t, fresh(t, aarush));
    expect(dSnap.transactions[0]).toMatchObject({ direction: "debit", amount: 250_00, status: "success", contactId: `u-${aarush.id}`, txnId: txn.txn_id });
    expect(aSnap.transactions[0]).toMatchObject({ direction: "credit", amount: 250_00, status: "success", contactId: `u-${diya.id}`, counterpartyName: "Diya" });
    expect(dSnap.contacts.some((c) => c.id === `u-${aarush.id}` && c.kind === "person")).toBe(true);
    // Both phones see the same reference number.
    expect(dSnap.transactions[0].ref).toBe(aSnap.transactions[0].ref);
    // On-us payment: TacketPay's clearing account nets back to zero, and no money was created.
    const view = networkView(t);
    expect(view.participants.find((p) => p.id === "tpay")!.clearing).toBe(0);
    expect(view.totals.ledgerSum).toBe(0);
    expect(view.txns[0].events.map((e) => e.state)).toEqual(["INITIATED", "VALIDATED", "DEBIT_PENDING", "DEBITED", "CREDIT_PENDING", "SUCCESS"]);
    // ₹10+ earns Diya a scratch card.
    expect(dSnap.rewards.some((r) => r.reason === "Earned for paying Aarush")).toBe(true);
  });

  it("moves nothing on a wrong PIN, a short balance or an unknown ID", () => {
    const t = network();
    const { diya, aarush } = people(t);
    expect(code(() => wallet.pay(t, diya, { payeeHandle: aarush.handle, amount: 100, method: "contact", pin: "0000" }))).toBe("PIN_INVALID");
    expect(code(() => wallet.pay(t, fresh(t, diya), { payeeHandle: aarush.handle, amount: 20_000_00, method: "contact", pin: "1234" }))).toBe(
      "INSUFFICIENT_FUNDS",
    );
    expect(code(() => wallet.pay(t, fresh(t, diya), { payeeHandle: "nobody@tpay", amount: 100, method: "contact", pin: "1234" }))).toBe("HANDLE_NOT_FOUND");
    expect(code(() => wallet.pay(t, fresh(t, diya), { payeeHandle: diya.handle, amount: 100, method: "contact", pin: "1234" }))).toBe("SELF_PAYMENT");
    expect(balance(t, diya)).toBe(STARTING_BALANCE);
    expect(balance(t, aarush)).toBe(STARTING_BALANCE);
    expect(networkView(t).counts).toMatchObject({ success: 0, failed: 2 });
  });

  it("pays a Tacket shop across participants and keeps clearing balanced", () => {
    const t = network();
    const { diya } = people(t);
    wallet.pay(t, diya, { payeeHandle: "chai.point@tacket", amount: 20_00, method: "qr", pin: "1234" });
    const shop = sql(t, "SELECT balance FROM ledger_accounts WHERE id = 'tacket:m:b-chai'").get() as { balance: number };
    expect(shop.balance).toBe(20_00);
    const view = networkView(t);
    expect(view.participants.find((p) => p.id === "tpay")!.clearing).toBe(20_00);
    expect(view.participants.find((p) => p.id === "tacket")!.clearing).toBe(-20_00);
    expect(view.totals.clearing).toBe(0);
    expect(ledgerSum(t)).toBe(0);
  });

  it("transfers to a made-up bank account through the Demo Bank Network", () => {
    const t = network();
    const { diya } = people(t);
    const handle = bankHandle("123456789012", "ABCD0123456");
    const { txn } = wallet.pay(t, diya, { payeeHandle: handle, payeeName: "Ravi Kumar", amount: 500_00, method: "bank", pin: "1234" });
    expect(txn).toMatchObject({ state: "SUCCESS", payee_name: "Ravi Kumar" });
    const snap = wallet.snapshot(t, fresh(t, diya));
    expect(snap.contacts.find((c) => c.handle === handle)).toMatchObject({ kind: "bank", name: "Ravi Kumar", subtitle: "A/c ••9012 · ABCD0123456" });
  });

  it("reverses the debit when the credit fails, so money never goes missing", () => {
    const t = network();
    const { diya, aarush } = people(t);
    // Fill Aarush's wallet to the ₹10,00,000 cap so the credit is refused.
    fillWallet(t, aarush);

    const { txn } = wallet.pay(t, diya, { payeeHandle: aarush.handle, amount: 300_00, method: "contact", pin: "1234" });
    expect(txn).toMatchObject({ state: "REVERSED", failure_code: "LIMIT_EXCEEDED" });
    expect(balance(t, diya)).toBe(STARTING_BALANCE);
    expect(balance(t, aarush)).toBe(MAX_BALANCE_PAISE);
    expect(wallet.snapshot(t, fresh(t, diya)).transactions[0]).toMatchObject({ status: "reversed", amount: 300_00 });
    expect(ledgerSum(t)).toBe(0);
  });

  it("caps Add money at ₹2,00,000 per rolling 24 hours", () => {
    let clock = 1_800_000_000_000;
    let n = 0;
    const t = openTpi(":memory:", {
      now: () => clock,
      id: () => `id${String(++n).padStart(6, "0")}`,
      rrn: () => String(600000000000 + ++n),
      random: () => 0.9,
    });
    bootstrap(t);
    const { diya } = people(t);
    wallet.topUp(t, fresh(t, diya), { amount: 1_00_000_00, pin: "1234" });
    clock += 60 * 60 * 1000;
    wallet.topUp(t, fresh(t, diya), { amount: 99_999_00, pin: "1234" });
    expect(code(() => wallet.topUp(t, fresh(t, diya), { amount: 1_01, pin: "1234" }))).toBe("TOPUP_LIMIT");
    expect(balance(t, diya)).toBe(STARTING_BALANCE + 1_99_999_00);
    wallet.topUp(t, fresh(t, diya), { amount: 1_00, pin: "1234" });
    // A day after the first top-up, that ₹1,00,000 no longer counts.
    clock += 23 * 60 * 60 * 1000 + 1;
    wallet.topUp(t, fresh(t, diya), { amount: 1_00_000_00, pin: "1234" });
    expect(code(() => wallet.topUp(t, fresh(t, diya), { amount: 1_00, pin: "1234" }))).toBe("TOPUP_LIMIT");
    expect(ledgerSum(t)).toBe(0);
  });

  it("pays once when the same request is retried", () => {
    const t = network();
    const { diya, aarush } = people(t);
    const input = { payeeHandle: aarush.handle, amount: 75_00, method: "contact" as const, pin: "1234", idemKey: "tap-1" };
    const a = wallet.pay(t, diya, input);
    const b = wallet.pay(t, fresh(t, diya), input);
    expect(b.txn.txn_id).toBe(a.txn.txn_id);
    expect(balance(t, diya)).toBe(STARTING_BALANCE - 75_00);
    expect(balance(t, aarush)).toBe(STARTING_BALANCE + 75_00);
  });

  it("refuses to reuse a payment's key for a different payment", () => {
    const t = network();
    const { diya, aarush } = people(t);
    const input = { payeeHandle: aarush.handle, amount: 75_00, method: "contact" as const, pin: "1234", idemKey: "tap-1" };
    wallet.pay(t, diya, input);
    expect(code(() => wallet.pay(t, fresh(t, diya), { ...input, amount: 80_00 }))).toBe("IDEMPOTENCY_MISMATCH");
    expect(code(() => wallet.pay(t, fresh(t, diya), { ...input, payeeHandle: "chai.point@tacket" }))).toBe("IDEMPOTENCY_MISMATCH");
    // Keys are per person: Aarush's "tap-1" is a different payment.
    expect(wallet.pay(t, aarush, { ...input, payeeHandle: diya.handle, pin: "4321" }).txn.state).toBe("SUCCESS");
    expect(balance(t, diya)).toBe(STARTING_BALANCE - 75_00 + 75_00);
    expect(networkView(t).counts.success).toBe(2);
  });

  it("returns the first result when a paid request or bill is retried with the same key", () => {
    const t = network();
    const { diya, aarush } = people(t);
    const id = wallet.requestMoney(t, aarush, { fromHandle: diya.handle, amount: 150_00 });
    const input = { payeeHandle: aarush.handle, amount: 150_00, method: "contact" as const, pin: "1234", requestId: id, idemKey: "tap-req" };
    const a = wallet.pay(t, diya, input);
    // The response was lost; the phone sends the same attempt again. It must not look like a failure.
    const b = wallet.pay(t, fresh(t, diya), input);
    expect(b.txn.txn_id).toBe(a.txn.txn_id);
    expect(b.activityId).toBe(a.activityId);
    // A new attempt for the already-paid request is still refused.
    expect(code(() => wallet.pay(t, fresh(t, diya), { ...input, idemKey: "tap-req-2" }))).toBe("REQUEST_NOT_PAYABLE");

    const billId = wallet.linkBill(t, fresh(t, diya), { categoryId: "electricity", providerId: "metro-power", accountNumber: "EL123456" });
    const due = wallet.snapshot(t, fresh(t, diya)).linkedBills.find((x) => x.id === billId)!.dueAmount;
    const billInput = { payeeHandle: billerHandle("metro-power"), amount: due, method: "bill" as const, pin: "1234", billId, idemKey: "tap-bill" };
    const c = wallet.pay(t, fresh(t, diya), billInput);
    expect(wallet.pay(t, fresh(t, diya), billInput).txn.txn_id).toBe(c.txn.txn_id);
    expect(balance(t, diya)).toBe(STARTING_BALANCE - 150_00 - due);
    expect(ledgerSum(t)).toBe(0);
  });

  it("finishes a payment that a crash interrupted after the debit", () => {
    const t = network();
    const { diya, aarush } = people(t);
    // The switch logged the payment and the payer debited it, then the process died.
    sql(
      t,
      `INSERT INTO tpi_txns (txn_id, rrn, payer_handle, payer_name, payer_pid, payer_account, payee_handle, payee_name, payee_pid,
         amount, method, state, created_at, updated_at)
       VALUES ('TPICRASH', '611111111111', ?, 'Diya', 'tpay', ?, ?, 'Aarush', 'tpay', 12300, 'contact', 'DEBIT_PENDING', 1, 1)`,
    ).run(diya.handle, wallet.snapshot(t, diya).accounts[0].id, aarush.handle);
    expect(PARTICIPANT_IMPL.tpay.debit(t, getTxn(t, "TPICRASH")!).ok).toBe(true);
    expect(balance(t, diya)).toBe(STARTING_BALANCE - 123_00);
    expect(balance(t, aarush)).toBe(STARTING_BALANCE);

    expect(resumePending(t)).toBe(1);
    expect(getTxn(t, "TPICRASH")!.state).toBe("SUCCESS");
    // The replayed Debit didn't take the money twice.
    expect(balance(t, diya)).toBe(STARTING_BALANCE - 123_00);
    expect(balance(t, aarush)).toBe(STARTING_BALANCE + 123_00);
  });
});

describe("requests, chat and rewards", () => {
  it("lets Aarush request money and Diya pay exactly that request", () => {
    const t = network();
    const { diya, aarush } = people(t);
    const id = wallet.requestMoney(t, aarush, { fromHandle: diya.handle, amount: 150_00, note: "Tickets" });
    const seen = wallet.snapshot(t, fresh(t, diya)).messages.find((m) => m.id === id);
    expect(seen).toMatchObject({ type: "request", from: "them", contactId: `u-${aarush.id}`, status: "pending", amount: 150_00 });

    expect(code(() => wallet.pay(t, diya, { payeeHandle: aarush.handle, amount: 100_00, method: "contact", pin: "1234", requestId: id }))).toBe(
      "AMOUNT_MISMATCH",
    );
    wallet.pay(t, fresh(t, diya), { payeeHandle: aarush.handle, amount: 150_00, method: "contact", pin: "1234", requestId: id });
    expect(wallet.snapshot(t, fresh(t, aarush)).messages.find((m) => m.id === id)).toMatchObject({ from: "me", status: "paid" });
    expect(code(() => wallet.respondRequest(t, fresh(t, diya), { messageId: id, action: "decline" }))).toBe("REQUEST_NOT_PAYABLE");
  });

  it("delivers chat messages to the other person", () => {
    const t = network();
    const { diya, aarush } = people(t);
    wallet.sendMessage(t, diya, { toHandle: aarush.handle, text: "Sending it now" });
    expect(wallet.snapshot(t, fresh(t, aarush)).messages.at(-1)).toMatchObject({ type: "text", from: "them", text: "Sending it now" });
  });

  it("credits a scratched reward once", () => {
    const t = network();
    const { diya } = people(t);
    const card = wallet.snapshot(t, diya).rewards.find((r) => r.amount)!;
    wallet.scratchReward(t, diya, card.id);
    wallet.scratchReward(t, fresh(t, diya), card.id);
    expect(balance(t, diya)).toBe(STARTING_BALANCE + card.amount!);
    expect(ledgerSum(t)).toBe(0);
  });

  it("does not mint a reward twice when another process scratched it first", () => {
    const t = network();
    const { diya } = people(t);
    const card = wallet.snapshot(t, diya).rewards.find((r) => r.amount)!;
    wallet.scratchReward(t, diya, card.id);
    // Simulate the race: the row read before the write still says "not scratched".
    const read = sql(t, "SELECT * FROM rewards WHERE id = ? AND user_id = ?");
    const original = read.get.bind(read) as (...args: SQLInputValue[]) => object;
    read.get = ((...args: SQLInputValue[]) => ({ ...original(...args), scratched: 0 })) as unknown as typeof read.get;
    wallet.scratchReward(t, fresh(t, diya), card.id);
    expect(balance(t, diya)).toBe(STARTING_BALANCE + card.amount!);
  });
});

describe("persistence", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("keeps balances and history after the network restarts", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "tpi-"));
    dirs.push(dir);
    const file = path.join(dir, "tpi.db");
    const first = network(file);
    const { diya, aarush } = people(first);
    wallet.pay(first, diya, { payeeHandle: aarush.handle, amount: 999_00, method: "contact", pin: "1234" });
    first.db.close();

    const again = openTpi(file);
    bootstrap(again);
    expect(balance(again, diya)).toBe(STARTING_BALANCE - 999_00);
    expect(balance(again, aarush)).toBe(STARTING_BALANCE + 999_00);
    expect(wallet.snapshot(again, fresh(again, aarush)).transactions.map((x) => x.method)).toEqual(["contact", "welcome"]);
    again.db.close();
  });
});

describe("system accounts", () => {
  it("names them per participant", () => {
    expect(systemAccount("tpay", "mint")).toBe("tpay:mint");
  });
});
