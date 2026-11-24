"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { rem } from "@/lib/rem";

const BRUSH = 26;
const REVEAL_AT = 0.45;

/**
 * Canvas scratch layer over the prize. Drag to scratch; once ~45% is cleared it dissolves.
 * A "Reveal" button gives keyboard and screen-reader users the same result.
 */
export function ScratchCard({ size = 260, onReveal, children }: { size?: number; onReveal: () => void; children: ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    // Draw in `size` units but at the real on-screen resolution (the card scales with the root font size).
    const dpr = window.devicePixelRatio || 1;
    const shown = c.getBoundingClientRect().width || size;
    c.width = Math.round(shown * dpr);
    c.height = Math.round(shown * dpr);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.scale((shown * dpr) / size, (shown * dpr) / size);
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, "#3b82ff");
    g.addColorStop(1, "#1f6ff2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // Confetti-like pattern so scratching feels tactile.
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % size;
      const y = (i * 53 + (i % 7) * 31) % size;
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.font = `500 18px ${getComputedStyle(document.body).fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillText("Scratch here", size / 2, size / 2 + 6);
    ctx.globalCompositeOperation = "destination-out";
  }, [size]);

  const reveal = () => {
    if (done.current) return;
    done.current = true;
    setRevealed(true);
    if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
    onReveal();
  };

  const clearedRatio = () => {
    const c = canvas.current!;
    const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) {
      total++;
      if (data[i] === 0) clear++;
    }
    return clear / total;
  };

  const last = useRef<{ x: number; y: number } | null>(null);
  const moves = useRef(0);
  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (done.current || (e.pointerType === "mouse" && e.buttons !== 1)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.lineCap = "round";
    ctx.lineWidth = BRUSH * 2;
    ctx.beginPath();
    ctx.moveTo(last.current?.x ?? x, last.current?.y ?? y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
    if (++moves.current % 8 === 0 && clearedRatio() > REVEAL_AT) reveal();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface shadow-e2" style={{ width: rem(size), height: rem(size) }}>
      <div className="absolute inset-0">{children}</div>
      <canvas
        ref={canvas}
        className={`absolute inset-0 size-full touch-none transition-opacity duration-300 ${revealed ? "pointer-events-none opacity-0" : "cursor-grab"}`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          last.current = null;
          scratch(e);
        }}
        onPointerMove={scratch}
        onPointerUp={() => (last.current = null)}
        aria-hidden="true"
      />
      {!revealed && (
        <button type="button" onClick={reveal} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/25 px-3 py-1 text-xs text-white backdrop-blur focus-visible:bg-black/50">
          Tap to reveal
        </button>
      )}
    </div>
  );
}
