"use client";
import { useEffect } from "react";
import { sync } from "@/lib/api";
import { getState } from "@/lib/store";

const POLL_MS = 2000;

/**
 * Keeps this phone's copy in step with TPI: checks right away (which also finds an existing session),
 * then every couple of seconds while the app is on screen, and again whenever it comes back into view.
 * That's how money Diya sends shows up on Aarush's phone without a refresh.
 */
export function SyncAgent() {
  useEffect(() => {
    let timer = 0;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "visible" && getState().onboarded) await sync();
      if (!stopped) timer = window.setTimeout(tick, POLL_MS);
    };
    void sync();
    timer = window.setTimeout(tick, POLL_MS);
    const wake = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
    };
  }, []);
  return null;
}
