/** Diagonal repeating "DEMO MONEY" text so a screenshot of a receipt can never pass as a real payment. */
export function Watermark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  // Mid-grey reads on both white and pure black.
  const fill = tone === "dark" ? "rgba(128,128,128,0.13)" : "rgba(255,255,255,0.14)";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='150'><text x='0' y='80' transform='rotate(-22 160 75)' font-family='sans-serif' font-size='17' font-weight='700' letter-spacing='3' fill='${fill}'>DEMO MONEY · NOT REAL</text></svg>`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, backgroundSize: "320px 150px" }}
    />
  );
}
