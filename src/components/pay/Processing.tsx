import { formatMoney } from "@/lib/money";

export function Processing({ amount, payee }: { amount: number; payee: string }) {
  return (
    <div className="animate-fade fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-bg text-text" role="status" aria-live="polite">
      <span className="animate-spin-slow size-12 rounded-full border-[0.1875rem] border-line border-t-primary" />
      <p className="text-lg">
        Paying {payee} <span className="money">{formatMoney(amount)}</span>
      </p>
      <p className="text-[0.8125rem] text-text-3">Routing over TPI · demo money, no real payment</p>
    </div>
  );
}
