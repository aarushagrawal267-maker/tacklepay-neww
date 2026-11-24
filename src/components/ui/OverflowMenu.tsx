"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { toast } from "./toast";

export interface MenuItem {
  label: string;
  onSelect?: () => void;
}

const FEEDBACK = "Feedback isn't collected in this demo";

/** The ⋮ menu that sits on nearly every screen of the reference app. */
export function OverflowMenu({ items, tone = "default" }: { items: MenuItem[]; tone?: "default" | "light" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`press grid size-11 place-items-center rounded-[0.625rem] ${tone === "light" ? "text-white" : "text-text"}`}
      >
        <Icon name="more_vert" />
      </button>
      {open && (
        <ul role="menu" className="animate-pop absolute right-1 top-12 z-50 min-w-[12.5rem] origin-top-right rounded-xl border border-line bg-surface p-1 text-text shadow-e2">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                role="menuitem"
                type="button"
                className="press w-full rounded-lg px-3 py-2.5 text-left text-[0.9375rem]"
                onClick={() => {
                  setOpen(false);
                  (item.onSelect ?? (() => toast(FEEDBACK)))();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const FEEDBACK_ITEM: MenuItem = { label: "Send feedback" };
