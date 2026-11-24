/** Animated check: ring burst, filled circle, then the tick draws itself. */
export function SuccessMark({ animate }: { animate: boolean }) {
  return (
    <span className="relative grid size-20 place-items-center" aria-hidden="true">
      {animate && <span className="absolute inset-0 rounded-full bg-current opacity-30 [animation:ring-burst_900ms_var(--ease-out)_both]" />}
      <span className={`grid size-20 place-items-center rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] ${animate ? "animate-pop" : ""}`}>
        <svg viewBox="0 0 48 48" className="size-11" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 25l8 8 16-17" strokeDasharray="48" style={animate ? { animation: "check-draw 420ms 220ms var(--ease-out) both" } : undefined} />
        </svg>
      </span>
    </span>
  );
}
