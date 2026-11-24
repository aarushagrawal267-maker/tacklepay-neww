import type { ReactNode } from "react";
import { Icon } from "./Icon";

type Tone = "danger" | "warn" | "info" | "success" | "neutral";

const TONES: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger",
  warn: "bg-warn-soft text-warn",
  info: "bg-primary-soft text-primary-fg",
  success: "bg-success-soft text-success",
  neutral: "bg-surface-3 text-text-2",
};

/** Small tinted status pill: "Overdue", "Partly paid", "Open", "Automatic". */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[0.8125rem] font-medium ${TONES[tone]} ${className}`}>{children}</span>;
}

/** The one non-negotiable addition to the replica: it always says the money is fake. */
export function DemoBadge({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1 rounded-md bg-demo px-2 text-[0.75rem] font-medium text-demo-ink ${className}`}>
      <Icon name="science" size={14} />
      {compact ? "Demo" : "Demo money"}
    </span>
  );
}

export function DemoNotice({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl bg-demo px-3.5 py-3 text-[0.8125rem] leading-snug text-demo-ink ${className}`}>
      <Icon name="info" size={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}
