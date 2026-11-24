"use client";
// The app's client for the TacketPay API (which sits on the TPI switch). Every call that changes
// something comes back with a fresh snapshot, which is applied to the store before the promise resolves.
import { toast } from "@/components/ui/toast";
import { formatMoney } from "./money";
import { applySnapshot, clearLocal, getState } from "./store";
import { TPI_ERROR_COPY, type NetworkView, type SettlementCycleView, type Snapshot, type TpiErrorCode, type TxnState } from "./tpi";
import type { Contact, TxMethod } from "./types";

export class ApiError extends Error {
  constructor(
    readonly code: TpiErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Copy for any error a call can throw. */
export function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : TPI_ERROR_COPY.INTERNAL;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError("OFFLINE", TPI_ERROR_COPY.OFFLINE, 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // The session is gone (signed out elsewhere, or the server's data was wiped): drop the cached copy.
    if (res.status === 401) clearLocal();
    const code = (data?.error?.code as TpiErrorCode | undefined) ?? "INTERNAL";
    throw new ApiError(code, data?.error?.message ?? TPI_ERROR_COPY[code] ?? TPI_ERROR_COPY.INTERNAL, res.status);
  }
  if (data?.snapshot) applySnapshot(data.snapshot as Snapshot);
  return data as T;
}

export interface PaymentResult {
  txnId: string;
  rrn: string;
  state: TxnState;
  failureCode: TpiErrorCode | null;
  activityId: string | null;
}

/** A fresh key per payment attempt, so a retried request can never pay twice. */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}

export const tpiApi = {
  signUp: (body: { name: string; phone: string; pin: string }) => call<{ snapshot: Snapshot }>("/api/auth/signup", { body }),
  signIn: (body: { phone: string; pin: string }) => call<{ snapshot: Snapshot }>("/api/auth/signin", { body }),
  async signOut() {
    await call("/api/auth/signout", { body: {} }).catch(() => undefined);
    clearLocal();
  },
  pay: (body: {
    payeeHandle: string;
    payeeName?: string;
    amount: number;
    note?: string;
    method: TxMethod;
    accountId?: string;
    pin: string;
    requestId?: string;
    billId?: string;
    idemKey: string;
  }) => call<{ payment: PaymentResult }>("/api/wallet/pay", { body }),
  topUp: (body: { amount: number; accountId?: string; pin: string }) => call<{ activityId: string }>("/api/wallet/topup", { body }),
  selfTransfer: (body: { fromId: string; toId: string; amount: number; pin: string }) =>
    call<{ activityId: string }>("/api/wallet/self-transfer", { body }),
  request: (body: { fromHandle: string; amount: number; note?: string }) => call<{ messageId: string }>("/api/wallet/request", { body }),
  respond: (body: { messageId: string; action: "decline" | "cancel" }) => call("/api/wallet/respond", { body }),
  message: (body: { toHandle: string; text: string }) => call("/api/wallet/message", { body }),
  scratch: (rewardId: string) => call("/api/wallet/scratch", { body: { rewardId } }),
  addAccount: () => call("/api/wallet/add-account", { body: {} }),
  setPrimary: (accountId: string) => call("/api/wallet/set-primary", { body: { accountId } }),
  addCard: () => call("/api/wallet/add-card", { body: {} }),
  linkBill: (body: { categoryId: string; providerId: string; accountNumber: string; label?: string }) =>
    call<{ billId: string }>("/api/wallet/link-bill", { body }),
  rename: (name: string) => call("/api/me", { method: "PATCH", body: { name } }),
  /** TPI's ValAdd: who owns this ID or phone number? */
  resolve: (body: { handle?: string; phone?: string; name?: string }) => call<{ contact: Contact }>("/api/wallet/resolve", { body }),
  network: () => call<NetworkView>("/api/tpi/network"),
  /** Close a settlement cycle now (operator console). */
  settle: () => call<{ cycle: SettlementCycleView; network: NetworkView }>("/api/tpi/settlement", { body: {} }),
};

let inflight: Promise<void> | null = null;

/**
 * Asks TPI whether anything changed since our copy and applies it. Shows a toast for money that
 * arrived from another person since the last sync, the way a payments app notifies you.
 */
export function sync(): Promise<void> {
  inflight ??= (async () => {
    const before = getState();
    const seen = new Set(before.transactions.map((t) => t.id));
    try {
      await call(`/api/me?since=${encodeURIComponent(before.rev)}`);
    } catch {
      return; // Offline or signed out; the next tick tries again.
    } finally {
      inflight = null;
    }
    if (!before.onboarded) return;
    for (const tx of getState().transactions) {
      if (!seen.has(tx.id) && tx.direction === "credit" && tx.contactId?.startsWith("u-")) {
        toast(`Received ${formatMoney(tx.amount)} from ${tx.counterpartyName}`, 4000);
        // Browsers refuse to vibrate before the first tap, and log an error if asked.
        if (navigator.userActivation?.hasBeenActive && navigator.vibrate) navigator.vibrate([20, 40, 20]);
      }
    }
  })();
  return inflight;
}
