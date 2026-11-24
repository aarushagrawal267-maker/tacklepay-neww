import { rem } from "@/lib/rem";

/** Tacket "T": a heavy top bar over a short stem. Takes currentColor, so it's black in light mode and white in dark. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" style={{ width: rem(size), height: rem(size) }} className={`text-text ${className}`} fill="currentColor" aria-hidden="true">
      <rect x="8" y="9" width="48" height="15" rx="4" />
      <path d="M22 24h18v27a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5V24Z" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-medium tracking-tight text-text ${className}`}>
      Tacket<span className="text-text-3">Pay</span>
    </span>
  );
}
