"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ensureContact } from "@/lib/actions";
import { errorText, tpiApi } from "@/lib/api";
import type { QrPayload } from "@/lib/qr";
import { getState, setState } from "@/lib/store";

export type ScanOutcome =
  | { kind: "navigated" }
  | { kind: "show"; payload: Extract<QrPayload, { kind: "upi" | "link" | "text" }> }
  | { kind: "error"; title: string; message: string };

/** What happens after a code is scanned, shared by the in-app scanner and /q deep links. */
export function useQrAction() {
  const router = useRouter();
  return useCallback(
    async (payload: QrPayload, mode: "push" | "replace" = "push"): Promise<ScanOutcome> => {
      const go = (path: string) => (mode === "replace" ? router.replace(path) : router.push(path));
      switch (payload.kind) {
        case "pay": {
          if (payload.handle === getState().profile.handle) {
            return { kind: "error", title: "That's your own code", message: "Show it to someone else so they can pay you demo money." };
          }
          // TPI's ValAdd: confirm who owns the code before showing a pay screen.
          let contact;
          try {
            ({ contact } = await tpiApi.resolve({ handle: payload.handle, name: payload.name }));
          } catch (err) {
            return { kind: "error", title: "Can't pay this code", message: errorText(err) };
          }
          setState((s) => ensureContact(s, contact).state);
          const params = new URLSearchParams({ src: "qr" });
          if (payload.amountPaise) params.set("am", String(payload.amountPaise));
          if (payload.note) params.set("tn", payload.note);
          go(`/pay/${contact.id}?${params}`);
          return { kind: "navigated" };
        }
        case "claim":
          return {
            kind: "error",
            title: "Receipt QR codes aren't needed any more",
            message: "Payments now go over TPI, so the money landed in the receiver's balance the moment it was paid. Check their transaction history.",
          };
        default:
          return { kind: "show", payload };
      }
    },
    [router],
  );
}
