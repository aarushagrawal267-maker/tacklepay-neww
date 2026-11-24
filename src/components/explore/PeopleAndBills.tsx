"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Dialog } from "@/components/ui/Sheet";
import { ensureContact } from "@/lib/actions";
import { errorText, tpiApi } from "@/lib/api";
import { isHandle } from "@/lib/qr";
import { setState, useStore } from "@/lib/store";

export function PeopleAndBills({ query }: { query: string }) {
  const router = useRouter();
  const contacts = useStore((s) => s.contacts);
  const myHandle = useStore((s) => s.profile.handle);
  const [dialog, setDialog] = useState<"choose" | "id" | null>(null);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string>();

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => c.kind === "person")
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.handle.includes(q) || (c.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, "")))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, query]);

  const verify = async () => {
    const value = handle.trim().toLowerCase();
    if (!isHandle(value)) return setError("TPI IDs look like name@tpay or shop@tacket");
    if (value === myHandle) return setError("That's your own ID");
    try {
      const { contact } = await tpiApi.resolve({ handle: value });
      setState((s) => ensureContact(s, contact).state);
      setDialog(null);
      router.push(`/chat/${contact.id}`);
    } catch (err) {
      setError(errorText(err));
    }
  };

  return (
    <div className="px-6 pb-10 pt-5">
      <h2 className="text-[0.9375rem] font-medium">Recharge and pay bills</h2>
      <div className="mt-4 flex gap-2">
        <Chip href="/recharge" icon="mobile" label="Mobile recharge" />
        <Chip href="/bills" icon="receipt_long" label="Bill payments" />
      </div>

      <h2 className="mt-7 text-[0.9375rem] font-medium">Transfer money</h2>
      <div className="mt-5 grid grid-cols-4 gap-2 text-center">
        <Circle href="/bank-transfer" icon="account_balance" label={"Bank\ntransfer"} />
        <Circle href="/phone" icon="dialpad" label={"Phone\nnumber"} />
        <Circle onClick={() => setDialog("choose")} icon="qr_code_2" label={"ID or\nQR code"} />
        <Circle href="/self-transfer" icon="sync_alt" label={"Self\ntransfer"} />
      </div>

      <h2 className="mt-8 text-[0.9375rem] font-medium">{query ? "Search results" : "All people"}</h2>
      {people.length === 0 &&
        (query ? (
          <p className="mt-4 text-sm text-text-2">No one matches “{query}”. Try a TPI ID with “ID or QR code”.</p>
        ) : (
          <p className="mt-4 text-sm text-text-2">No one else is on TacketPay yet. Ask a friend to open this site on their phone and create an account.</p>
        ))}
      <ul className="mt-2">
        {people.map((c) => (
          <li key={c.id}>
            <Link href={`/chat/${c.id}`} className="press -mx-2 flex items-center gap-5 rounded-2xl px-2 py-2.5">
              <ContactAvatar contact={c} size={44} />
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem]">{c.name}</span>
                <span className="money block truncate text-[0.8125rem] text-text-2">{c.phone ?? c.handle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Dialog open={dialog === "choose"} onClose={() => setDialog(null)} title="Pay to" actions={<Button variant="text" onClick={() => setDialog(null)}>Cancel</Button>}>
        <div className="-mx-2 space-y-1">
          <button
            type="button"
            className="press flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-sm font-bold text-text"
            onClick={() => {
              setHandle("");
              setError(undefined);
              setDialog("id");
            }}
          >
            <Icon name="alternate_email" /> TacketPay ID
          </button>
          <button type="button" className="press flex w-full items-center gap-4 rounded-xl px-2 py-3 text-left text-[0.9375rem] font-medium text-text" onClick={() => router.push("/scan")}>
            <Icon name="qr_code_scanner" /> Open code scanner
          </button>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "id"}
        onClose={() => setDialog(null)}
        title="Enter TacketPay ID"
        actions={
          <>
            <Button variant="text" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="text" onClick={() => void verify()}>
              Verify
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <label className="flex items-center gap-2 border-b border-line pb-1 focus-within:border-primary-fg">
            <span className="text-sm text-text-2">To:</span>
            <input
              data-autofocus
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                setError(undefined);
              }}
              placeholder="name@tpay"
              autoCapitalize="none"
              autoCorrect="off"
              aria-label="TacketPay ID"
              aria-invalid={!!error}
              className="h-10 min-w-0 flex-1 bg-transparent text-base text-text outline-none"
            />
          </label>
          <p role="alert" className="mt-2 min-h-4 text-xs text-danger">
            {error}
          </p>
        </form>
      </Dialog>
    </div>
  );
}

function Chip({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className="press flex h-11 flex-1 items-center justify-center gap-2 rounded-[0.625rem] border border-button-line bg-button px-3 text-sm font-medium shadow-e1">
      <Icon name={icon} size={20} className="text-text-2" />
      {label}
    </Link>
  );
}

function Circle({ href, onClick, icon, label }: { href?: string; onClick?: () => void; icon: IconName; label: string }) {
  const body = (
    <>
      <span className="grid size-[3.125rem] place-items-center rounded-[0.875rem] bg-surface-2 text-text dark:bg-surface-3">
        <Icon name={icon} size={26} />
      </span>
      <span className="mt-3 whitespace-pre-line text-xs leading-tight">{label}</span>
    </>
  );
  const cls = "press flex flex-col items-center rounded-2xl py-1";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}
