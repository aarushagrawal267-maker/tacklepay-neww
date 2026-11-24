"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noop = () => () => {};

/** Renders into the phone "device" so overlays stay inside it on desktop too. */
export function Portal({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(
    noop,
    () => document.getElementById("device"),
    () => null,
  );
  return target ? createPortal(children, target) : null;
}
