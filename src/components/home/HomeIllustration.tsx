/**
 * Quiet line-art street scene for the home header: the GPay layout's illustrated band, redrawn in
 * Tacket greys with a single blue accent. Colours come from CSS variables, so it follows the theme
 * (soft grey on white, dim grey on pure black).
 */
export function HomeIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      <g fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Sun and clouds */}
        <circle cx="318" cy="34" r="13" fill="var(--surface-3)" />
        <path d="M44 40h34a9 9 0 0 0-9-9 12 12 0 0 0-22 2 7 7 0 0 0-3 7Z" fill="var(--bg)" />
        <path d="M236 28h26a7 7 0 0 0-7-7 9 9 0 0 0-17 1 5 5 0 0 0-2 6Z" fill="var(--bg)" />

        {/* Skyline */}
        <path d="M8 132V82h30v50M38 132V64h26v68M70 132V92h22v40" fill="var(--surface-2)" />
        <path d="M300 132V70h28v62M328 132V88h22v44M354 132V58h30v74" fill="var(--surface-2)" />
        {[0, 1, 2].map((r) =>
          [0, 1].map((c) => <rect key={`l${r}${c}`} x={44 + c * 10} y={72 + r * 14} width="5" height="7" rx="1" />),
        )}
        {[0, 1, 2, 3].map((r) => [0, 1].map((c) => <rect key={`r${r}${c}`} x={361 + c * 11} y={66 + r * 14} width="5" height="7" rx="1" />))}

        {/* Shop with an awning — the "spot" you pay at */}
        <path d="M130 132V96h76v36" fill="var(--bg)" />
        <path d="M124 96h88l-6-14h-76Z" fill="var(--primary-soft)" stroke="var(--primary-fg)" />
        <path d="M139 96v-14M154 96v-14M169 96v-14M184 96v-14M199 96v-14" stroke="var(--primary-fg)" strokeOpacity=".6" />
        <rect x="140" y="106" width="22" height="26" rx="2" />
        <rect x="172" y="106" width="26" height="14" rx="2" />
        {/* Tiny QR on the counter */}
        <rect x="178" y="109" width="8" height="8" rx="1" stroke="var(--primary-fg)" />

        {/* Two people meeting at the shop */}
        <circle cx="222" cy="104" r="4.5" fill="var(--bg)" />
        <path d="M222 109v12M222 113l-6 5M222 113l6 4M222 121l-4 11M222 121l4 11" />
        <circle cx="244" cy="102" r="4.5" fill="var(--bg)" />
        <path d="M244 107v14M244 112l-7 3M244 112l5 6M244 121l-4 11M244 121l4 11" />

        {/* Tree */}
        <path d="M272 132v-22" />
        <circle cx="272" cy="100" r="13" fill="var(--surface-2)" />

        {/* Scooter */}
        <circle cx="98" cy="128" r="4" fill="var(--bg)" />
        <circle cx="118" cy="128" r="4" fill="var(--bg)" />
        <path d="M98 128h14l6-12h-6M106 128l2-8h8" />

        {/* Ground */}
        <path d="M0 132h400" />
      </g>
    </svg>
  );
}
