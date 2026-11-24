"use client";
import { useToasts } from "./toast";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="animate-rise max-w-[21.25rem] rounded-xl bg-[#111] px-4 py-3 text-sm text-white shadow-e2 dark:border dark:border-line-strong">
          {t.text}
        </div>
      ))}
    </div>
  );
}
