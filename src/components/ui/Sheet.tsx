"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Portal } from "./Portal";

function useOverlay(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus], button, [href], input, textarea, select");
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && node) {
        // Keep focus inside the overlay.
        const items = Array.from(node.querySelectorAll<HTMLElement>("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")).filter(
          (el) => !el.hasAttribute("disabled"),
        );
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose, panel]);
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, panel);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex flex-col justify-end">
        <div className="animate-fade absolute inset-0 bg-[var(--scrim)]" onClick={onClose} aria-hidden="true" />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          className={`animate-sheet relative max-h-[88%] overflow-y-auto rounded-t-[1.25rem] border-t border-line bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-e2 @2xl:mx-auto @2xl:mb-6 @2xl:w-full @2xl:max-w-[32rem] @2xl:rounded-[1.25rem] @2xl:border ${className}`}
        >
          <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-line-strong" aria-hidden="true" />
          {title && (
            <h2 id={titleId} className="px-5 pt-4 text-lg font-medium">
              {title}
            </h2>
          )}
          {children}
        </div>
      </div>
    </Portal>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useOverlay(open, onClose, panel);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] grid place-items-center p-6">
        <div className="animate-fade absolute inset-0 bg-[var(--scrim)]" onClick={onClose} aria-hidden="true" />
        <div
          ref={panel}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="animate-pop relative w-full max-w-[20.625rem] rounded-2xl border border-line bg-surface p-5 shadow-e2"
        >
          <h2 id={titleId} className="text-lg font-medium">
            {title}
          </h2>
          {children && <div className="mt-4 text-sm leading-relaxed text-text-2">{children}</div>}
          <div className="mt-6 flex justify-end gap-2">{actions}</div>
        </div>
      </div>
    </Portal>
  );
}
