import { describe, expect, it } from "vitest";
import { buildPayLink, parseQr } from "../qr";

const ORIGIN = "https://tacketpay.example";

describe("QR payloads", () => {
  it("round-trips a pay link with amount and note", () => {
    const link = buildPayLink(ORIGIN, { handle: "ria@tpay", name: "Ria", amountPaise: 12_50, note: "Chai" });
    expect(parseQr(link)).toEqual({ kind: "pay", handle: "ria@tpay", name: "Ria", amountPaise: 1250, note: "Chai" });
  });

  it("works for links from any host, so codes survive a redeploy", () => {
    const link = buildPayLink("http://localhost:3000", { handle: "ria@tpay", name: "Ria" });
    expect(parseQr(link)).toMatchObject({ kind: "pay", handle: "ria@tpay" });
  });

  it("reads TPI handles of every participant and nothing else", () => {
    for (const handle of ["diya@tpay", "chai.point@tacket", "ac123456789.abcd0123456@demobank"]) {
      expect(parseQr(buildPayLink(ORIGIN, { handle, name: "X" }))).toMatchObject({ kind: "pay", handle });
    }
    expect(parseQr(`${ORIGIN}/q?t=pay&pa=diya@okaxis&pn=X`)).toMatchObject({ kind: "link" });
  });

  it("still recognises a receipt QR from before TPI", () => {
    const link = `${ORIGIN}/q?t=claim&tx=ABCDEFGH1234&pa=ria%40tacket&fa=bob%40tacket&fn=Bob&am=500.00`;
    expect(parseQr(link)).toEqual({
      kind: "claim",
      txId: "ABCDEFGH1234",
      toHandle: "ria@tacket",
      fromHandle: "bob@tacket",
      fromName: "Bob",
      amountPaise: 50000,
    });
  });

  it("accepts the bare deep link form", () => {
    expect(parseQr("tacketpay://pay?t=pay&pa=shop@tacket&pn=Shop")).toMatchObject({ kind: "pay", handle: "shop@tacket" });
  });

  it("flags real UPI codes instead of paying them", () => {
    expect(parseQr("upi://pay?pa=merchant@okbank&pn=Merchant&am=10")).toEqual({
      kind: "upi",
      raw: "upi://pay?pa=merchant@okbank&pn=Merchant&am=10",
      payee: "merchant@okbank",
    });
  });

  it("rejects malformed handles and hostile amounts", () => {
    expect(parseQr(`${ORIGIN}/q?t=pay&pa=not-a-handle&pn=X`)).toEqual({ kind: "link", url: `${ORIGIN}/q?t=pay&pa=not-a-handle&pn=X` });
    expect(parseQr(`${ORIGIN}/q?t=pay&pa=a.b@tacket&am=-5`)).toMatchObject({ kind: "pay", amountPaise: undefined });
    expect(parseQr(`${ORIGIN}/q?t=pay&pa=a.b@tacket&am=99999999`)).toMatchObject({ kind: "pay", amountPaise: undefined });
    expect(parseQr(`${ORIGIN}/q?t=claim&pa=a.b@tacket&fa=c@tacket&tx=x&am=5`)).toMatchObject({ kind: "link" });
  });

  it("treats anything else as text or a link", () => {
    expect(parseQr("hello")).toEqual({ kind: "text", text: "hello" });
    expect(parseQr("https://example.com/menu")).toEqual({ kind: "link", url: "https://example.com/menu" });
  });
});
