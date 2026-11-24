import Link from "next/link";
import type { ReactNode } from "react";

/** Grey ledger card (list rows) or bordered card (stats). */
export function Card({ children, className = "", tone = "fill" }: { children: ReactNode; className?: string; tone?: "fill" | "outline" }) {
  return (
    <section className={`rounded-2xl ${tone === "fill" ? "bg-surface-2" : "border border-line bg-surface"} ${className}`}>{children}</section>
  );
}

/** "Owed to you / ₹38,200 / 11 customers" stat tile. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "danger" | "due" | "success";
  href?: string;
}) {
  const color = { default: "text-text", danger: "text-danger", due: "text-due", success: "text-success" }[tone];
  const body = (
    <>
      <span className="block text-[0.9375rem] text-text-2">{label}</span>
      <span className={`money mt-2 block truncate text-[1.625rem] font-medium leading-tight ${color}`}>{value}</span>
      {hint && <span className="mt-1.5 block text-[0.8125rem] leading-snug text-text-2">{hint}</span>}
    </>
  );
  const cls = "block min-w-0 rounded-2xl border border-line bg-surface p-5 text-left";
  return href ? (
    <Link href={href} className={`press ${cls}`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Two-up segmented control, as in "Who owes you | Who you owe". */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-xl bg-surface-3 p-1 dark:bg-surface-2">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          type="button"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`h-9 min-w-0 flex-1 truncate rounded-lg px-3 text-[0.875rem] transition-colors ${
            value === o.id ? "border border-line bg-surface text-text shadow-e1 dark:border-line-strong dark:bg-surface-2" : "text-text-2"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
