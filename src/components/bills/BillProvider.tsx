"use client";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoBadge";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { NotFound } from "@/components/ui/NotFound";
import { Screen, ScreenSkeleton, ScrollBody } from "@/components/ui/Screen";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { errorText, tpiApi } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { BILL_CATEGORIES } from "@/lib/seed";
import { useHydrated, useStore } from "@/lib/store";
import type { LinkedBill } from "@/lib/types";

const ACCOUNT_RE = /^[A-Za-z0-9-]{6,20}$/;

/** Link-a-biller flow from the reference DthLink / DthLinkForm components, then pay the (demo) bill. */
export function BillProvider() {
  const { category, provider } = useParams<{ category: string; provider: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const linked = useStore((s) => s.linkedBills);
  const [linking, setLinking] = useState(false);
  const [number, setNumber] = useState("");
  const [label, setLabel] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const cat = BILL_CATEGORIES.find((c) => c.id === category);
  const prov = cat?.providers.find((p) => p.id === provider);
  if (!cat || !prov) return <NotFound title="Biller not found" body="Pick a biller from Bill payments." />;
  if (!hydrated) return <ScreenSkeleton />;

  const accounts = linked.filter((b) => b.providerId === prov.id);
  const error = touched && !ACCOUNT_RE.test(number.trim()) ? "Enter a valid account number, mobile number or MAC ID (6–20 letters or digits)" : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!ACCOUNT_RE.test(number.trim()) || saving) return;
    setSaving(true);
    try {
      await tpiApi.linkBill({ categoryId: cat.id, providerId: prov.id, accountNumber: number.trim().toUpperCase(), label: label || undefined });
      setLinking(false);
      setNumber("");
      setLabel("");
      setTouched(false);
      toast("Account linked");
    } catch (err) {
      toast(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const payBill = (bill: LinkedBill) => {
    // Every biller is a shop on the Tacket participant, with the same id on the server and here.
    const params = new URLSearchParams({
      am: String(bill.dueAmount),
      lock: "1",
      method: "bill",
      bill: bill.id,
      tn: `${cat.name} bill · ${bill.accountNumber}`,
      detail: `${bill.label ? bill.label + " · " : ""}Account ${bill.accountNumber}`,
    });
    router.push(`/pay/bill-${prov.id}?${params}`);
  };

  if (linking) {
    return (
      <Screen>
        <TopBar nav="close" onNav={() => setLinking(false)} title="Link account" />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <ScrollBody className="space-y-5 px-5 pt-6">
            <div className="flex items-center gap-3">
              <Avatar name={prov.name} size={40} />
              <span className="text-[0.9375rem] font-medium">{prov.name}</span>
            </div>
            <Field
              label="Account number / Mobile number / MAC ID"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onBlur={() => setTouched(true)}
              autoCapitalize="characters"
              autoComplete="off"
              error={error}
              hint={!error ? "Use any made-up number — nothing is checked with a real biller" : undefined}
              data-autofocus
            />
            <Field label="Account name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24} hint="Eg: Home" />
            <p className="text-xs leading-relaxed text-text-2">
              {prov.name} is a fictional biller, a shop on the TPI network. Linking saves this number to your TacketPay account so you can try paying a bill with demo money.
            </p>
          </ScrollBody>
          <div className="flex justify-end p-5">
            <button type="submit" aria-label="Link account" className="press grid size-14 place-items-center rounded-2xl bg-primary text-white shadow-e2">
              <Icon name="chevron_right" size={30} />
            </button>
          </div>
        </form>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={prov.name} fallback={`/bills/${cat.id}`} menu={[{ label: "Refresh", onSelect: () => toast("Up to date") }, { label: "Send feedback" }]} />
      <ScrollBody className="px-5 pb-10 pt-6">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center pt-10 text-center">
            <span className="grid size-20 place-items-center rounded-3xl bg-surface-2 text-text-2">
              <Icon name={cat.icon} size={40} />
            </span>
            <h1 className="mt-5 text-xl font-medium">No accounts linked</h1>
            <p className="mt-2 max-w-[17.5rem] text-sm text-text-2">Link your {prov.name} account to pay and track your bills easily.</p>
            <Button className="mt-8" icon="add" onClick={() => setLinking(true)}>
              Get started
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {accounts.map((b) => (
                <li key={b.id} className="rounded-2xl bg-surface-2 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={prov.name} size={40} />
                    <div className="min-w-0">
                      <p className="truncate text-[0.9375rem] font-medium">{b.label ?? prov.name}</p>
                      <p className="truncate text-xs text-text-2">{b.accountNumber}</p>
                    </div>
                  </div>
                  {b.dueAmount > 0 ? (
                    <>
                      <p className="mt-4 text-xs text-text-2">Bill due</p>
                      <p className="money text-3xl font-medium text-due">{formatMoney(b.dueAmount)}</p>
                      <Button block className="mt-4" onClick={() => payBill(b)}>
                        Pay {formatMoney(b.dueAmount)}
                      </Button>
                    </>
                  ) : (
                    <p className="mt-4 flex items-center gap-2 text-sm text-success">
                      <Icon name="check_circle" filled size={20} /> No bill due. You&apos;re all paid up.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="outlined" icon="add" className="mt-4" onClick={() => setLinking(true)}>
              Link another account
            </Button>
          </>
        )}
        <DemoNotice className="mt-10">Bill amounts are generated for the demo. Paying them uses demo money and no real biller is contacted.</DemoNotice>
      </ScrollBody>
    </Screen>
  );
}
