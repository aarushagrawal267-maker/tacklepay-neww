// All money is stored as integer paise so arithmetic never drifts.
// Every amount in TacketPay is demo money — nothing here touches a real account.

export const CURRENCY_SYMBOL = "₹";
export const MAX_PAYMENT_PAISE = 1_00_000_00; // ₹1,00,000 per payment, like real UPI limits
/** Demo balances are capped so a stuck finger on "Add money" can't create absurd numbers. */
export const MAX_BALANCE_PAISE = 10_00_000_00;

const grouping = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const groupingFixed = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function formatMoney(paise: number, opts: { sign?: boolean; fixed?: boolean } = {}): string {
  const abs = Math.abs(paise) / 100;
  const body = (opts.fixed ? groupingFixed : grouping).format(abs);
  const sign = opts.sign ? (paise < 0 ? "- " : "+ ") : paise < 0 ? "-" : "";
  return `${sign}${CURRENCY_SYMBOL}${body}`;
}

/** Parses keypad text like "1250.5" into paise. Returns null for anything malformed. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,7}(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

/** Applies one keypad press to the amount being typed, enforcing a sane shape. */
export function pressAmountKey(current: string, key: string): string {
  if (key === "back") return current.slice(0, -1);
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;
  const next = current === "0" ? key : current + key;
  const [whole, frac] = next.split(".");
  if (frac !== undefined && frac.length > 2) return current;
  if (whole.length > 6) return current;
  return next;
}

/** Groups the whole-rupee part of keypad text for display ("125000.5" → "1,25,000.5"). */
export function groupTyped(text: string): string {
  if (!text) return text;
  const [whole, frac] = text.split(".");
  const grouped = new Intl.NumberFormat("en-IN").format(Number(whole || "0"));
  return frac !== undefined ? `${grouped}.${frac}` : grouped;
}
