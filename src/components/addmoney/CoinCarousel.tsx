import { Coin, type CoinKind } from "./Coin";
import { rem } from "@/lib/rem";

const RING: CoinKind[] = ["in", "inr", "us", "eu", "tacket", "uk", "jp", "usd", "br", "ae", "eur", "co", "gbp", "yen"];

/**
 * The spinning coin ring from the reference: coins sit on a circle in 3D and the ring turns,
 * so coins at the front face you and coins at the sides go edge-on. Each coin has a few
 * stacked rims for thickness. With reduced motion it holds still at a pleasing angle.
 */
export function CoinCarousel({ size = 58, radius = 132, speed = 16 }: { size?: number; radius?: number; speed?: number }) {
  const step = 360 / RING.length;
  return (
    <div className="relative mx-auto h-[5.25rem] w-full [perspective:700px]" aria-hidden="true">
      <div
        className="absolute left-1/2 top-1/2 [transform-style:preserve-3d] motion-safe:[animation:coin-spin_var(--spin)_linear_infinite]"
        style={{ "--spin": `${speed}s`, transform: "rotateY(-20deg)" } as React.CSSProperties}
      >
        {RING.map((kind, i) => (
          <div
            key={kind}
            className="absolute [transform-style:preserve-3d]"
            style={{ width: rem(size), height: rem(size), left: rem(-size / 2), top: rem(-size / 2), transform: `rotateY(${i * step}deg) translateZ(${rem(radius)})` }}
          >
            {[3, 2, 1].map((d) => (
              <span key={d} className="absolute inset-0 rounded-full bg-[#9aa0a6] [backface-visibility:hidden] dark:bg-[#3a3a3a]" style={{ transform: `translateZ(${-d}px)`, filter: `brightness(${1 - d * 0.12})` }} />
            ))}
            <Coin kind={kind} size={size} className="absolute inset-0 [backface-visibility:hidden]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A loose, gently floating cluster for detail steps. */
export function CoinCluster({ groups }: { groups: CoinKind[][] }) {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      {groups.map((g, gi) => (
        <div key={gi} className="relative h-[5.75rem]" style={{ width: rem(64 + (g.length - 1) * 30) }}>
          {g.map((k, i) => (
            <span
              key={k}
              className="absolute motion-safe:[animation:coin-float_3.2s_ease-in-out_infinite]"
              style={{ left: rem(i * 30), top: rem(i % 2 ? 22 : 4), zIndex: i === 1 ? 3 : 2 - i, animationDelay: `${(gi * 3 + i) * 0.35}s` }}
            >
              <Coin kind={k} size={i === 1 ? 72 : 62} className="drop-shadow-[0_6px_10px_rgb(0_0_0/0.18)]" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
