// QR payloads. TacketPay codes are plain https links so a phone's own camera can open
// them too; the in-app scanner understands both these links and the bare deep links.
// Field names mirror UPI (pa = payee address, pn = payee name, am = amount, tn = note)
// so they feel familiar, but they only ever move demo money over TPI.

import { formatMoney } from "./money";
import { isTpiHandle } from "./tpi";

export type QrPayload =
  | { kind: "pay"; handle: string; name: string; amountPaise?: number; note?: string }
  /** A receipt QR from before TPI, when the payee had to scan it to receive money. Recognised only to explain it. */
  | { kind: "claim"; txId: string; toHandle: string; fromHandle: string; fromName: string; amountPaise: number }
  | { kind: "upi"; raw: string; payee?: string }
  | { kind: "link"; url: string }
  | { kind: "text"; text: string };

export const isHandle = isTpiHandle;

export function buildPayLink(origin: string, p: { handle: string; name: string; amountPaise?: number; note?: string }): string {
  const params = new URLSearchParams({ t: "pay", pa: p.handle, pn: p.name });
  if (p.amountPaise) params.set("am", (p.amountPaise / 100).toFixed(2));
  if (p.note) params.set("tn", p.note);
  return `${origin}/q?${params.toString()}`;
}

function amountFrom(params: URLSearchParams): number | undefined {
  const am = params.get("am");
  if (!am) return undefined;
  const n = Number(am);
  if (!Number.isFinite(n) || n <= 0 || n > 1_00_000) return undefined;
  return Math.round(n * 100);
}

/** Turns the query of a /q link (or deep link) into a payload, or null if it isn't ours. */
export function payloadFromParams(params: URLSearchParams): QrPayload | null {
  const type = params.get("t");
  const handle = (params.get("pa") ?? "").toLowerCase();
  if (!isHandle(handle)) return null;
  if (type === "pay") {
    const name = (params.get("pn") ?? "").trim().slice(0, 40) || handle.split("@")[0];
    const note = params.get("tn")?.trim().slice(0, 60) || undefined;
    return { kind: "pay", handle, name, amountPaise: amountFrom(params), note };
  }
  if (type === "claim") {
    const txId = params.get("tx") ?? "";
    const fromHandle = (params.get("fa") ?? "").toLowerCase();
    const amountPaise = amountFrom(params);
    if (!/^[A-Za-z0-9]{6,32}$/.test(txId) || !isHandle(fromHandle) || !amountPaise) return null;
    const fromName = (params.get("fn") ?? "").trim().slice(0, 40) || fromHandle.split("@")[0];
    return { kind: "claim", txId, toHandle: handle, fromHandle, fromName, amountPaise };
  }
  return null;
}

/** Classifies any scanned text. Never throws. */
export function parseQr(raw: string): QrPayload {
  const text = raw.trim();
  if (/^upi:\/\//i.test(text)) {
    let payee: string | undefined;
    try {
      payee = new URL(text).searchParams.get("pa") ?? undefined;
    } catch {
      payee = undefined;
    }
    return { kind: "upi", raw: text, payee };
  }
  if (/^tacketpay:\/\//i.test(text)) {
    const query = text.split("?")[1] ?? "";
    return payloadFromParams(new URLSearchParams(query)) ?? { kind: "text", text };
  }
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.pathname === "/q") {
        const payload = payloadFromParams(url.searchParams);
        if (payload) return payload;
      }
      return { kind: "link", url: url.toString() };
    } catch {
      return { kind: "text", text };
    }
  }
  return { kind: "text", text };
}

export function describePayload(p: QrPayload): string {
  switch (p.kind) {
    case "pay":
      return p.amountPaise ? `Pay ${p.name} ${formatMoney(p.amountPaise)}` : `Pay ${p.name}`;
    case "claim":
      return `Receipt from ${p.fromName} for ${formatMoney(p.amountPaise)}`;
    case "upi":
      return "Real UPI code";
    case "link":
      return p.url;
    case "text":
      return p.text;
  }
}
