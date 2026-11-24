"use client";
import { useEffect, useRef, useState } from "react";
import { Scanner } from "@/components/scan/Scanner";
import { Home } from "./Home";

/**
 * Home and the QR scanner side by side, like the reference app's reversed PageView:
 * swipe right from home to reveal the camera. row-reverse makes home the initial page
 * without any scroll-position flash before hydration.
 */
export function HomePager() {
  const pager = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLElement>(null);
  const scannerRef = useRef<HTMLElement>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  useEffect(() => {
    const target = scannerRef.current;
    if (!target || !pager.current) return;
    const io = new IntersectionObserver(([entry]) => setScannerVisible(entry.intersectionRatio > 0.6), {
      root: pager.current,
      threshold: [0, 0.6, 1],
    });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  const show = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });

  return (
    <div ref={pager} className="no-scrollbar flex h-full snap-x snap-mandatory flex-row-reverse overflow-x-auto overflow-y-hidden overscroll-x-contain">
      <section ref={homeRef} aria-label="Home" className="h-full w-full shrink-0 snap-start snap-always" inert={scannerVisible}>
        <Home onOpenScanner={() => show(scannerRef.current)} />
      </section>
      <section ref={scannerRef} aria-label="QR scanner" className="h-full w-full shrink-0 snap-start snap-always" inert={!scannerVisible}>
        <Scanner active={scannerVisible} onClose={() => show(homeRef.current)} />
      </section>
    </div>
  );
}
