import { describe, expect, it } from "vitest";
import { formatMoney, groupTyped, parseAmount, pressAmountKey } from "../money";

describe("formatMoney", () => {
  it("uses Indian digit grouping", () => {
    expect(formatMoney(1_23_456_78)).toBe("₹1,23,456.78");
    expect(formatMoney(500_00)).toBe("₹500");
  });
  it("adds signs on request", () => {
    expect(formatMoney(-500_00, { sign: true })).toBe("- ₹500");
    expect(formatMoney(20_00, { sign: true })).toBe("+ ₹20");
  });
  it("can pad paise", () => {
    expect(formatMoney(5_00, { fixed: true })).toBe("₹5.00");
  });
});

describe("parseAmount", () => {
  it("parses whole and fractional rupees", () => {
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("12.5")).toBe(1250);
    expect(parseAmount("0.05")).toBe(5);
    expect(parseAmount("12.")).toBe(1200);
  });
  it("rejects junk", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("-4")).toBeNull();
    expect(parseAmount("1e5")).toBeNull();
  });
});

describe("pressAmountKey", () => {
  it("builds amounts and blocks a second dot and third decimal", () => {
    let v = "";
    for (const k of ["1", "2", ".", "5", ".", "0", "9"]) v = pressAmountKey(v, k);
    expect(v).toBe("12.50");
  });
  it("replaces a leading zero and supports backspace", () => {
    expect(pressAmountKey("0", "7")).toBe("7");
    expect(pressAmountKey("", ".")).toBe("0.");
    expect(pressAmountKey("123", "back")).toBe("12");
  });
  it("caps at six whole digits", () => {
    expect(pressAmountKey("999999", "9")).toBe("999999");
  });
});

describe("groupTyped", () => {
  it("groups whole rupees and keeps what was typed after the dot", () => {
    expect(groupTyped("125000")).toBe("1,25,000");
    expect(groupTyped("2000.5")).toBe("2,000.5");
    expect(groupTyped("12.")).toBe("12.");
    expect(groupTyped("")).toBe("");
  });
});
