"use client";
import { useEffect, useState } from "react";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { LogoMark } from "@/components/ui/Logo";

/** Cold-start splash from the reference app (logo centred, name at the bottom), kept short. */
export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");
  useEffect(() => {
    const fade = window.setTimeout(() => setPhase("fade"), 550);
    const gone = window.setTimeout(() => setPhase("gone"), 800);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
  }, []);
  if (phase === "gone") return null;
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-[90] flex flex-col items-center justify-center bg-surface transition-opacity duration-200 ${phase === "fade" ? "pointer-events-none opacity-0" : ""}`}
    >
      <LogoMark size={96} />
      <div className="absolute bottom-10 flex flex-col items-center gap-3">
        <span className="text-[1.625rem] font-bold text-text-2">TacketPay</span>
        <DemoBadge />
      </div>
    </div>
  );
}
