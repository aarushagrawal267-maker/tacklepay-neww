"use client";
import { Icon } from "./Icon";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"] as const;

/**
 * Numeric keyboard from the reference app's NumericPad: 26px bold digits, 3×4 grid.
 * Hidden on laptops with a mouse or trackpad, where every screen that uses it takes typed keys instead.
 */
export function Keypad({ onKey, allowDecimal = true, tone = "light" }: { onKey: (key: string) => void; allowDecimal?: boolean; tone?: "light" | "dark" }) {
  return (
    <div className="mx-auto grid w-full max-w-[28rem] grid-cols-3 gap-1.5 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:pointer-fine:hidden">
      {KEYS.map((k) => {
        if (k === "." && !allowDecimal) return <span key={k} />;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k)}
            aria-label={k === "back" ? "Delete" : k === "." ? "Decimal point" : k}
            className={`press money mx-auto grid h-14 w-full place-items-center rounded-xl text-[1.625rem] font-medium ${tone === "dark" ? "text-white" : "text-text"}`}
          >
            {k === "back" ? <Icon name="backspace" /> : k}
          </button>
        );
      })}
    </div>
  );
}
