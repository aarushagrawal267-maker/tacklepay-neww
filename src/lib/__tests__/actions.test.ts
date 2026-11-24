import { describe, expect, it } from "vitest";
import { ensureContact, primaryAccount, totalBalance } from "../actions";
import { initialState, MERCHANTS } from "../seed";
import type { State } from "../types";

function withAccounts(): State {
  return {
    ...initialState(),
    accounts: [
      { id: "a1", bank: "Tacket Demo Bank", last4: "1111", type: "Savings account", balance: 500_00, primary: false },
      { id: "a2", bank: "Play Money Bank", last4: "2222", type: "Current account", balance: 250_00, primary: true },
    ],
  };
}

describe("balances", () => {
  it("adds up every account and finds the primary one", () => {
    const s = withAccounts();
    expect(totalBalance(s)).toBe(750_00);
    expect(primaryAccount(s)?.id).toBe("a2");
  });
});

describe("ensureContact", () => {
  it("reuses a known handle, so a shop keeps the id the server gave it", () => {
    const s = initialState();
    const shop = MERCHANTS[0];
    const r = ensureContact(s, { id: "other", name: "Anything", handle: shop.handle, kind: "business" });
    expect(r.contact.id).toBe(shop.id);
    expect(r.state).toBe(s);
  });

  it("adds a bank payee typed in on this device", () => {
    const r = ensureContact(initialState(), { id: "x-1", name: "  Ravi Kumar ", handle: "ac123456789.abcd0123456@demobank", kind: "bank" });
    expect(r.contact).toMatchObject({ id: "x-1", name: "Ravi Kumar", kind: "bank" });
    expect(r.state.contacts.at(-1)).toBe(r.contact);
  });
});

describe("merchants", () => {
  it("gives every shop, biller and operator a unique id and @tacket handle", () => {
    expect(new Set(MERCHANTS.map((m) => m.id)).size).toBe(MERCHANTS.length);
    expect(new Set(MERCHANTS.map((m) => m.handle)).size).toBe(MERCHANTS.length);
    expect(MERCHANTS.every((m) => /^[a-z0-9._-]{2,40}@tacket$/.test(m.handle))).toBe(true);
  });
});
