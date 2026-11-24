import { useId, type ReactNode } from "react";
import { rem } from "@/lib/rem";

export type CoinKind =
  | "in"
  | "jp"
  | "ae"
  | "co"
  | "us"
  | "eu"
  | "uk"
  | "br"
  | "inr"
  | "usd"
  | "eur"
  | "gbp"
  | "yen"
  | "tacket"
  | "bank";

// Simplified flag and currency faces, drawn in a 100×100 box and clipped to a circle.
function Face({ kind }: { kind: CoinKind }) {
  switch (kind) {
    case "in":
      return (
        <>
          <rect width="100" height="34" fill="#FF9933" />
          <rect y="33" width="100" height="34" fill="#fff" />
          <rect y="66" width="100" height="34" fill="#138808" />
          <circle cx="50" cy="50" r="11" fill="none" stroke="#000080" strokeWidth="2.5" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="50" y1="50" x2={50 + 11 * Math.cos((i * Math.PI) / 6)} y2={50 + 11 * Math.sin((i * Math.PI) / 6)} stroke="#000080" strokeWidth="1.2" />
          ))}
        </>
      );
    case "jp":
      return (
        <>
          <rect width="100" height="100" fill="#fff" />
          <circle cx="50" cy="50" r="20" fill="#BC002D" />
        </>
      );
    case "ae":
      return (
        <>
          <rect width="100" height="34" fill="#00732F" />
          <rect y="33" width="100" height="34" fill="#fff" />
          <rect y="66" width="100" height="34" fill="#000" />
          <rect width="28" height="100" fill="#FF0000" />
        </>
      );
    case "co":
      return (
        <>
          <rect width="100" height="50" fill="#FCD116" />
          <rect y="50" width="100" height="25" fill="#003893" />
          <rect y="75" width="100" height="25" fill="#CE1126" />
        </>
      );
    case "us":
      return (
        <>
          {Array.from({ length: 13 }, (_, i) => (
            <rect key={i} y={i * 7.7} width="100" height="7.7" fill={i % 2 ? "#fff" : "#B22234"} />
          ))}
          <rect width="46" height="54" fill="#3C3B6E" />
          {Array.from({ length: 20 }, (_, i) => (
            <circle key={i} cx={6 + (i % 5) * 8.5} cy={7 + Math.floor(i / 5) * 12} r="2" fill="#fff" />
          ))}
        </>
      );
    case "eu":
      return (
        <>
          <rect width="100" height="100" fill="#003399" />
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx={50 + 26 * Math.cos((i * Math.PI) / 6)} cy={50 + 26 * Math.sin((i * Math.PI) / 6)} r="3.6" fill="#FFCC00" />
          ))}
        </>
      );
    case "uk":
      return (
        <>
          <rect width="100" height="100" fill="#012169" />
          <path d="M0 0 100 100M100 0 0 100" stroke="#fff" strokeWidth="18" />
          <path d="M0 0 100 100M100 0 0 100" stroke="#C8102E" strokeWidth="6" />
          <path d="M50 0v100M0 50h100" stroke="#fff" strokeWidth="26" />
          <path d="M50 0v100M0 50h100" stroke="#C8102E" strokeWidth="14" />
        </>
      );
    case "br":
      return (
        <>
          <rect width="100" height="100" fill="#009C3B" />
          <path d="M50 16 90 50 50 84 10 50Z" fill="#FFDF00" />
          <circle cx="50" cy="50" r="18" fill="#002776" />
          <path d="M33 46q17-6 34 4" stroke="#fff" strokeWidth="3" fill="none" />
        </>
      );
    case "tacket":
      return (
        <>
          <rect width="100" height="100" fill="#0b0d10" />
          <g fill="#fff" transform="translate(26 26) scale(.75)">
            <rect x="8" y="9" width="48" height="15" rx="4" />
            <path d="M22 24h18v27a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5V24Z" />
          </g>
        </>
      );
    case "bank":
      return (
        <>
          <rect width="100" height="100" fill="#e7f6ec" />
          <path d="M50 24 76 38H24Z M28 42h8v24h-8Z M46 42h8v24h-8Z M64 42h8v24h-8Z M24 70h52v7H24Z" fill="#15803d" />
        </>
      );
    default: {
      const glyph: Record<string, [string, string]> = {
        inr: ["₹", "#1f6ff2"],
        usd: ["$", "#15803d"],
        eur: ["€", "#7c3aed"],
        gbp: ["£", "#d92d20"],
        yen: ["¥", "#c2570c"],
      };
      const [g, c] = glyph[kind];
      return (
        <>
          <rect width="100" height="100" fill={c} />
          <circle cx="50" cy="50" r="38" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" />
          <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontSize="46" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
            {g}
          </text>
        </>
      );
    }
  }
}

/** A glossy coin face. `size` in px. */
export function Coin({ kind, size = 64, className = "", children }: { kind: CoinKind; size?: number; className?: string; children?: ReactNode }) {
  const id = `coin-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" style={{ width: rem(size), height: rem(size) }} className={className} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        <radialGradient id={`${id}-g`} cx="32%" cy="26%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <Face kind={kind} />
        <rect width="100" height="100" fill={`url(#${id}-g)`} />
      </g>
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="#000" strokeOpacity=".12" strokeWidth="3" />
      {children}
    </svg>
  );
}

/** Overlapping mini coins with a "+N" chip, as on the option cards. */
export function CoinStack({ kinds, more }: { kinds: CoinKind[]; more?: number }) {
  return (
    <span className="mt-2 flex items-center">
      {kinds.map((k, i) => (
        <span key={k} className="-ml-1.5 rounded-full ring-2 ring-[var(--surface-2)] first:ml-0" style={{ zIndex: kinds.length - i }}>
          <Coin kind={k} size={24} />
        </span>
      ))}
      {more ? <span className="money ml-1.5 text-[0.8125rem] text-text-2">+{more}</span> : null}
    </span>
  );
}
