import { describe, expect, it } from "vitest";
import { MAX_BALANCE_PAISE } from "@/lib/money";
import { STARTING_BALANCE } from "@/lib/seed";
import { bankHandle } from "@/lib/tpi";
import { openTpi, sql, TpiError, type Tpi } from "../db";
import { signUp } from "../identity";
import { ledgerSum, post, systemAccount } from "../ledger";
import { bootstrap, networkView } from "../network";
import { userById, type UserRow } from "../records";
import { closeCycle, reconcile, settleIfDue, settlementView } from "../settlement";
import * as wallet from "../wallet";

function network(): Tpi {
  let n = 0;
  let clock = 1_800_000_000_000;
  const t = openTpi(":memory:", {
    now: () => (clock += 1000),
    id: () => `id${String(++n).padStart(6, "0")}`,
    rrn: () => String(700000000000 + ++n),
    random: () => 0.9,
  });
  bootstrap(t);
  return t;
}

const fresh = (t: Tpi, u: UserRow) => userById(t, u.id)!;
const clearing = (t: Tpi, pid: "tpay" | "tacket" | "demobank") =>
  (sql(t, "SELECT balance FROM ledger_accounts WHERE id = ?").get(systemAccount(pid, "clearing")) as { balance: number }).balance;

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
  const aarush = signUp(t, { name: "Aarush", phone: "91234 56789", pin: "4321" }).user;
  return { diya, aarush };
}

describe("settlement cycles", () => {
  it("nets positions to zero, empties clearing and settles each payment once", () => {
    const t = network();
    const { diya, aarush } = people(t);
    wallet.pay(t, diya, { payeeHandle: aarush.handle, amount: 250_00, method: "contact", pin: "1234" });
    wallet.pay(t, fresh(t, diya), { payeeHandle: "chai.point@tacket", amount: 40_00, method: "qr", pin: "1234" });
    wallet.pay(t, fresh(t, aarush), { payeeHandle: bankHandle("123456789012", "ABCD0123456"), payeeName: "Ravi", amount: 100_00, method: "bank", pin: "4321" });
    expect(clearing(t, "tpay")).toBe(140_00);

    expect(settlementView(t).unsettled).toBe(3);
    const cycle = closeCycle(t);
    expect(cycle).toMatchObject({ id: 1, txnCount: 3, gross: 390_00, trigger: "manual" });
    const net = Object.fromEntries(cycle.positions.map((p) => [p.participant, p.net]));
    expect(net).toEqual({ tpay: -140_00, tacket: 40_00, demobank: 100_00 });
    expect(cycle.positions.reduce((s, p) => s + p.net, 0)).toBe(0);

    // Clearing is fully absorbed into the settlement accounts; no money was created or lost.
    for (const pid of ["tpay", "tacket", "demobank"] as const) expect(clearing(t, pid)).toBe(0);
    expect(ledgerSum(t)).toBe(0);
    const view = networkView(t);
    expect(view.participants.find((p) => p.id === "tacket")!.settled).toBe(40_00);
    expect(view.totals.minted).toBe(2 * STARTING_BALANCE);
    expect(view.settlement).toMatchObject({ unsettled: 0, exceptions: [] });

    // Nothing new: a second cycle is refused, and the timer job just reports it.
    expect(code(() => closeCycle(t))).toBe("NOTHING_TO_SETTLE");
    expect(settleIfDue(t)).toBe("NOTHING_TO_SETTLE");

    // The next payment lands in the next cycle only.
    wallet.pay(t, fresh(t, diya), { payeeHandle: "chai.point@tacket", amount: 10_00, method: "qr", pin: "1234" });
    const next = settleIfDue(t);
    expect(next).toMatchObject({ id: 2, txnCount: 1, trigger: "timer" });
    expect(settlementView(t).cycles.map((c) => c.id)).toEqual([2, 1]);
  });

  it("includes reversed payments with a zero net and ignores failed ones", () => {
    const t = network();
    const { diya, aarush } = people(t);
    // Mint straight into Aarush's wallet up to the ₹10,00,000 cap so the credit is refused.
    const account = wallet.snapshot(t, fresh(t, aarush)).accounts[0];
    const left = MAX_BALANCE_PAISE - account.balance;
    post(t, { participant: "tpay", kind: "topup", lines: [{ account: systemAccount("tpay", "mint"), amount: -left }, { account: account.id, amount: left }] });
    const { txn } = wallet.pay(t, diya, { payeeHandle: aarush.handle, amount: 300_00, method: "contact", pin: "1234" });
    expect(txn.state).toBe("REVERSED");
    expect(code(() => wallet.pay(t, fresh(t, diya), { payeeHandle: "nobody@tpay", amount: 100, method: "contact", pin: "1234" }))).toBe("HANDLE_NOT_FOUND");

    expect(reconcile(t)).toEqual([]);
    const cycle = closeCycle(t);
    expect(cycle).toMatchObject({ txnCount: 1, gross: 0 });
    expect(cycle.positions).toEqual([{ participant: "tpay", net: 0, txnCount: 1 }]);
    expect(ledgerSum(t)).toBe(0);
  });
});

describe("reconciliation", () => {
  it("flags a planted mismatch and refuses to settle until it is fixed", () => {
    const t = network();
    const { diya } = people(t);
    const { txn } = wallet.pay(t, diya, { payeeHandle: "chai.point@tacket", amount: 20_00, method: "qr", pin: "1234" });
    expect(reconcile(t)).toEqual([]);

    // Plant a mismatch: Tacket "loses" its record of the credit.
    const credit = sql(t, "SELECT id FROM journals WHERE participant = 'tacket' AND txn_id = ? AND kind = 'credit'").get(txn.txn_id) as { id: string };
    sql(t, "UPDATE journals SET txn_id = NULL WHERE id = ?").run(credit.id);

    const exceptions = reconcile(t);
    expect(exceptions).toEqual([{ txnId: txn.txn_id, rrn: txn.rrn, state: "SUCCESS", participant: "tacket", problem: expect.stringContaining("missing credit") }]);
    expect(networkView(t).settlement.exceptions).toHaveLength(1);
    expect(code(() => closeCycle(t))).toBe("RECON_MISMATCH");
    expect(settleIfDue(t)).toBe("RECON_MISMATCH");
    // Refusing wrote nothing.
    expect(settlementView(t).cycles).toEqual([]);
    expect(clearing(t, "tacket")).toBe(-20_00);

    sql(t, "UPDATE journals SET txn_id = ? WHERE id = ?").run(txn.txn_id, credit.id);
    expect(reconcile(t)).toEqual([]);
    expect(closeCycle(t).txnCount).toBe(1);
  });
});

describe("settlement property (plan §14)", () => {
  /** Small seeded PRNG so a failing case can be replayed from its seed. */
  function mulberry32(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("for random payment sets (seed %i), every cycle nets to zero and empties clearing", (seed) => {
    const rand = mulberry32(seed);
    const t = network();
    const { diya, aarush } = people(t);
    const ravi = signUp(t, { name: "Ravi", phone: "99887 76655", pin: "5555" }).user;
    const payers = [
      { user: diya, pin: "1234" },
      { user: aarush, pin: "4321" },
      { user: ravi, pin: "5555" },
    ];
    const payees = [diya.handle, aarush.handle, ravi.handle, "chai.point@tacket", bankHandle("123456789012", "ABCD0123456"), "nobody@tpay"];
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

    let settledCycles = 0;
    for (let round = 0; round < 4; round++) {
      const count = 5 + Math.floor(rand() * 20);
      for (let i = 0; i < count; i++) {
        const payer = pick(payers);
        const payeeHandle = pick(payees);
        if (payeeHandle === payer.user.handle) continue;
        // Up to ₹6,000, so some payments run out of balance and fail before any debit.
        const amount = 1 + Math.floor(rand() * 6_000_00);
        try {
          wallet.pay(t, fresh(t, payer.user), { payeeHandle, payeeName: "Ravi", amount, method: "contact", pin: payer.pin });
        } catch (err) {
          if (!(err instanceof TpiError)) throw err;
        }
      }
      expect(reconcile(t)).toEqual([]);
      const out = settleIfDue(t);
      if (typeof out === "string") {
        expect(out).toBe("NOTHING_TO_SETTLE");
      } else {
        settledCycles++;
        expect(out.positions.reduce((sum, p) => sum + p.net, 0)).toBe(0);
      }
      // After every cycle nothing is left in clearing, no money appeared or vanished, and nothing waits to settle.
      for (const pid of ["tpay", "tacket", "demobank"] as const) expect(clearing(t, pid)).toBe(0);
      expect(ledgerSum(t)).toBe(0);
      expect(settlementView(t).unsettled).toBe(0);
    }
    expect(settledCycles).toBeGreaterThan(0);
    // Each finished payment was settled exactly once.
    const dupes = sql(t, "SELECT txn_id FROM settlement_items GROUP BY txn_id HAVING COUNT(*) > 1").all();
    expect(dupes).toEqual([]);
  });
});
