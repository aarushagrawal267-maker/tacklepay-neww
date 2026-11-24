"use client";
import { useRouter } from "next/navigation";
import { NumberEntry } from "@/components/recharge/NumberEntry";
import { toast } from "@/components/ui/toast";
import { ensureContact } from "@/lib/actions";
import { ApiError, errorText, tpiApi } from "@/lib/api";
import { setState } from "@/lib/store";

export function PhonePay() {
  const router = useRouter();
  return (
    <NumberEntry
      title="Start a payment"
      hint="Pays the TacketPay account registered to this number."
      onPick={async (digits, contact) => {
        if (contact) return router.push(`/chat/${contact.id}`);
        // Like UPI's "pay to mobile number": find the TacketPay account linked to it.
        try {
          const { contact: found } = await tpiApi.resolve({ phone: digits });
          setState((s) => ensureContact(s, found).state);
          router.push(`/pay/${found.id}?method=phone`);
        } catch (err) {
          const missing = err instanceof ApiError && err.code === "HANDLE_NOT_FOUND";
          toast(missing ? `No TacketPay account uses +91 ${digits.slice(0, 5)} ${digits.slice(5)}` : errorText(err), 4000);
        }
      }}
    />
  );
}
