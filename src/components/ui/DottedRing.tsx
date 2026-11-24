import { useMemo } from "react";
import { rem } from "@/lib/rem";

/** Halftone ring of dots around the avatar, drawn as SVG (stands in for the reference "spot code" art). */
export function DottedRing({ size, children }: { size: number; children: React.ReactNode }) {
  const dots = useMemo(() => {
    const out: { x: number; y: number; r: number; o: number }[] = [];
    const rings = 9;
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      const radius = 0.6 + t * 0.38;
      const count = Math.round(34 + t * 40);
      const dotR = 0.011 + Math.sin(t * Math.PI) * 0.01;
      for (let j = 0; j < count; j++) {
        const a = (j / count) * Math.PI * 2 + i * 0.35;
        out.push({ x: 0.5 + Math.cos(a) * radius * 0.5, y: 0.5 + Math.sin(a) * radius * 0.5, r: dotR, o: 0.35 + Math.sin(t * Math.PI) * 0.65 });
      }
    }
    return out;
  }, []);
  return (
    <span className="relative inline-grid place-items-center" style={{ width: rem(size), height: rem(size) }}>
      <svg viewBox="0 0 1 1" style={{ width: rem(size), height: rem(size) }} className="absolute inset-0 text-primary-fg" aria-hidden="true">
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" opacity={d.o} />
        ))}
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
