"use client";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/toast";
import type { ScanOutcome } from "./useQrAction";

type Shown = Exclude<ScanOutcome, { kind: "navigated" }>;

export function ScanResultSheet({ outcome, onClose }: { outcome: Shown | null; onClose: () => void }) {
  return (
    <Sheet open={!!outcome} onClose={onClose}>
      {outcome && <Body outcome={outcome} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ outcome, onClose }: { outcome: Shown; onClose: () => void }) {
  if (outcome.kind === "error") {
    return (
      <div className="px-6 pb-2 pt-5 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <Icon name="error" size={30} />
        </span>
        <h2 className="mt-4 text-xl font-medium">{outcome.title}</h2>
        <p className="mt-2 text-sm text-text-2">{outcome.message}</p>
        <Button block className="mt-6" onClick={onClose} data-autofocus>
          Scan again
        </Button>
      </div>
    );
  }

  const p = outcome.payload;
  if (p.kind === "upi") {
    return (
      <div className="px-6 pb-2 pt-5">
        <span className="grid size-14 place-items-center rounded-2xl bg-demo text-demo-ink">
          <Icon name="warning" size={30} />
        </span>
        <h2 className="mt-4 text-xl font-medium">This is a real UPI code</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-2">
          {p.payee ? (
            <>
              It belongs to <span className="font-medium text-text">{p.payee}</span>.{" "}
            </>
          ) : null}
          TacketPay only moves demo money, so it can&apos;t pay real merchants or people. Use your bank&apos;s UPI app for real payments.
        </p>
        <Button block className="mt-6" onClick={onClose} data-autofocus>
          Scan again
        </Button>
      </div>
    );
  }

  const text = p.kind === "link" ? p.url : p.text;
  return (
    <div className="px-6 pb-2 pt-5">
      <h2 className="text-xl font-medium">{p.kind === "link" ? "Link found" : "Text found"}</h2>
      <p className="mt-1 text-sm text-text-2">This isn&apos;t a TacketPay payment code.</p>
      <p className="mt-4 break-all rounded-2xl bg-surface-2 p-5 font-mono text-[0.8125rem]">{text}</p>
      <div className="mt-6 flex gap-3">
        <Button
          variant="outlined"
          className="flex-1"
          icon="content_copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast("Copied");
            } catch {
              toast("Couldn't copy");
            }
          }}
        >
          Copy
        </Button>
        {p.kind === "link" ? (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="press inline-flex h-11 flex-1 items-center justify-center rounded-[0.625rem] bg-primary text-[0.9375rem] font-medium text-white">
            Open link
          </a>
        ) : (
          <Button className="flex-1" onClick={onClose} data-autofocus>
            Scan again
          </Button>
        )}
      </div>
    </div>
  );
}
