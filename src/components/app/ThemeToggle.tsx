"use client";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { setTheme } from "@/lib/actions";
import { setState } from "@/lib/store";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

/** One-tap light/dark switch. Picks the opposite of what's on screen and saves it (Settings still offers "System"). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const resolved = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => null,
  );
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setState((s) => setTheme(s, next))}
      aria-label={resolved ? `Switch to ${next} mode` : "Switch theme"}
      title={resolved ? `Switch to ${next} mode` : undefined}
      className={`press grid size-10 place-items-center rounded-[0.625rem] text-text-2 ${className}`}
    >
      {/* The icon shows the mode you'll switch to; nothing until hydrated so it can't flash the wrong one. */}
      {resolved && (
        <span key={resolved} className="animate-pop">
          <Icon name={resolved === "dark" ? "light_mode" : "dark_mode"} size={22} />
        </span>
      )}
    </button>
  );
}
