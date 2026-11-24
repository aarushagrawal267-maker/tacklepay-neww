import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { LogoMark } from "./Logo";
import { rem } from "@/lib/rem";

/** Crisp SVG QR code with the TacketPay mark in the middle (error correction Q leaves room for it). */
export function QrCode({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const { path, count } = useMemo(() => {
    const qr = qrcode(0, "Q");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    return { path: d, count: n };
  }, [value]);

  const logo = Math.round(size * 0.2);
  return (
    <div className="relative inline-block rounded-2xl bg-white p-3" style={{ width: rem(size + 24), height: rem(size + 24) }}>
      <svg role="img" aria-label={label} viewBox={`0 0 ${count} ${count}`} style={{ width: rem(size), height: rem(size) }} shapeRendering="crispEdges">
        <path d={path} fill="#010101" />
      </svg>
      <span className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-white p-1" style={{ width: rem(logo), height: rem(logo) }}>
        <LogoMark size={logo - 8} className="!text-[#0b0d10]" />
      </span>
    </div>
  );
}
