"use client";
import { useRouter } from "next/navigation";
import { NumberEntry } from "./NumberEntry";

export function Recharge() {
  const router = useRouter();
  return (
    <NumberEntry
      title="Mobile recharge"
      onPick={(digits, contact) => {
        const params = new URLSearchParams({ n: digits });
        if (contact) params.set("name", contact.name);
        router.push(`/recharge/plans?${params}`);
      }}
    />
  );
}
