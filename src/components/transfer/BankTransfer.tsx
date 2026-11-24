"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { LineField } from "@/components/ui/Field";
import { Screen, ScrollBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { ensureContact } from "@/lib/actions";
import { setState } from "@/lib/store";
import { bankHandle, externalContactId } from "@/lib/tpi";

// Real IFSC shape (4 letters, 0, 6 alphanumerics) so the form feels right; nothing is looked up.
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

type Errors = Partial<Record<"account" | "confirm" | "ifsc" | "name", string>>;

function validate(v: { account: string; confirm: string; ifsc: string; name: string }): Errors {
  const e: Errors = {};
  if (!/^\d{9,18}$/.test(v.account)) e.account = "Account numbers have 9 to 18 digits";
  if (v.confirm !== v.account) e.confirm = "Account numbers don't match";
  if (!IFSC_RE.test(v.ifsc)) e.ifsc = "IFSC looks like ABCD0123456";
  if (v.name.trim().length < 2) e.name = "Enter the recipient's name";
  return e;
}

/** "Enter bank details" form from the reference BankTransferComponent, validated before paying. */
export function BankTransfer() {
  const router = useRouter();
  const [v, setV] = useState({ account: "", confirm: "", ifsc: "", name: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const errors = validate(v);
  const valid = Object.keys(errors).length === 0;
  const show = (k: keyof Errors) => (touched[k] ? errors[k] : undefined);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: k === "ifsc" ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) : k === "name" ? e.target.value.slice(0, 40) : e.target.value.replace(/\D/g, "").slice(0, 18) }));
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ account: true, confirm: true, ifsc: true, name: true });
    if (!valid) return;
    // The Demo Bank Network participant receives it; nothing reaches a real bank.
    const handle = bankHandle(v.account, v.ifsc);
    const id = externalContactId(handle);
    setState((s) => ensureContact(s, { id, name: v.name.trim(), handle, kind: "bank", subtitle: `A/c ••${v.account.slice(-4)} · ${v.ifsc}`, color: "#5f6670" }).state);
    router.push(`/pay/${id}?method=bank`);
  };

  return (
    <Screen>
      <TopBar title="Enter bank details" />
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <ScrollBody className="space-y-8 px-5 pt-8">
          <LineField label="Account number" inputMode="numeric" autoComplete="off" value={v.account} onChange={set("account")} onBlur={blur("account")} error={show("account")} />
          <LineField label="Re-enter account number" inputMode="numeric" autoComplete="off" value={v.confirm} onChange={set("confirm")} onBlur={blur("confirm")} error={show("confirm")} onPaste={(e) => e.preventDefault()} />
          <LineField label="IFSC" autoCapitalize="characters" autoComplete="off" value={v.ifsc} onChange={set("ifsc")} onBlur={blur("ifsc")} error={show("ifsc")} placeholder="ABCD0123456" />
          <LineField label="Recipient name" autoComplete="off" value={v.name} onChange={set("name")} onBlur={blur("name")} error={show("name")} />
        </ScrollBody>
        <div className="px-7 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 text-center">
          <p className="text-sm text-text-2">Use made-up details. Nothing is sent to a bank — this transfer only moves demo money.</p>
          <Button type="submit" size="lg" block className="mt-4" disabled={!valid}>
            Continue
          </Button>
        </div>
      </form>
    </Screen>
  );
}
