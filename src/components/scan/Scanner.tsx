"use client";
import Link from "next/link";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { toast } from "@/components/ui/toast";
import { buildPayLink, parseQr } from "@/lib/qr";
import { SEED_BUSINESSES } from "@/lib/seed";
import { decodeFile } from "./decoder";
import { ScanResultSheet } from "./ScanResultSheet";
import { useCamera, type CameraStatus } from "./useCamera";
import { useQrAction, type ScanOutcome } from "./useQrAction";

function subscribeVisibility(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

const STATUS_COPY: Partial<Record<CameraStatus, { title: string; body: string }>> = {
  denied: { title: "Camera access is off", body: "Allow camera access for this site in your browser settings, or upload a photo of the QR code." },
  unavailable: { title: "No camera found", body: "Upload a photo or screenshot of the QR code instead." },
  insecure: { title: "Camera needs a secure link", body: "Open TacketPay over https to scan. You can still upload a QR image." },
  error: { title: "Couldn't start the camera", body: "Another app may be using it. Try again, or upload a QR image." },
};

/** Full-screen QR scanner from the reference app, with a real camera and decoder behind it. */
export function Scanner({ active, onClose }: { active: boolean; onClose: () => void }) {
  const pageVisible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => false);
  const [outcome, setOutcome] = useState<Exclude<ScanOutcome, { kind: "navigated" }> | null>(null);
  const [busy, setBusy] = useState(false);
  const act = useQrAction();
  const fileInput = useRef<HTMLInputElement>(null);

  const handleText = useCallback(
    async (text: string) => {
      if (navigator.vibrate) navigator.vibrate(30);
      // Pauses the camera while TPI checks who the code belongs to.
      setBusy(true);
      try {
        const result = await act(parseQr(text));
        if (result.kind !== "navigated") setOutcome(result);
      } finally {
        setBusy(false);
      }
    },
    [act],
  );

  const scanning = active && pageVisible && !outcome && !busy;
  const { videoRef, status, torchSupported, torchOn, toggleTorch, retry } = useCamera(scanning, handleText);
  // Leaving the scanner dismisses any result, so it doesn't greet you next time.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setOutcome(null);
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await decodeFile(file);
      if (text) await handleText(text);
      else toast("No QR code found in that image");
    } catch (err) {
      console.warn("[tacketpay] Could not read image", err);
      toast("Couldn't read that image");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const tryDemoShop = () => {
    const shop = SEED_BUSINESSES[0];
    void handleText(buildPayLink(window.location.origin, { handle: shop.handle, name: shop.name, amountPaise: 20_00, note: "Masala chai" }));
  };

  const problem = STATUS_COPY[status];

  return (
    <div className="relative h-full overflow-hidden bg-black text-white">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted aria-hidden="true" />

      {/* Viewfinder with dimmed surroundings and the four-colour corners of the reference camera mask. */}
      <div className={`pointer-events-none absolute left-1/2 top-[42%] size-[16.875rem] -translate-x-1/2 -translate-y-1/2 ${problem ? "hidden" : ""}`}>
        <div className="absolute inset-0 rounded-[1.375rem] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" />
        <svg viewBox="0 0 310 310" className="absolute -inset-5 size-[19.375rem]" fill="none" strokeWidth="6" strokeLinecap="round" aria-hidden="true">
          <path d="M3 60V30A27 27 0 0 1 30 3h30" stroke="#ffffff" />
          <path d="M250 3h30a27 27 0 0 1 27 27v30" stroke="#ffffff" />
          <path d="M307 250v30a27 27 0 0 1-27 27h-30" stroke="#ffffff" />
          <path d="M60 307H30A27 27 0 0 1 3 280v-30" stroke="#ffffff" />
        </svg>
        {status === "live" && <div className="absolute inset-x-5 top-5 h-0.5 rounded-full bg-primary [animation:scan-line_2.6s_ease-in-out_infinite]" />}
        {status === "starting" && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="animate-spin-slow size-10 rounded-full border-4 border-white/30 border-t-white" />
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-1 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onClose} aria-label="Close scanner" className="press grid size-11 place-items-center rounded-[0.625rem]">
          <Icon name="close" />
        </button>
        {torchSupported && (
          <button type="button" onClick={toggleTorch} aria-pressed={torchOn} aria-label="Flashlight" className="press grid size-11 place-items-center rounded-[0.625rem]">
            <Icon name={torchOn ? "flashlight_on" : "flashlight_off"} filled={torchOn} />
          </button>
        )}
      </div>

      {problem && (
        <div className="animate-pop absolute inset-x-5 top-[26%] rounded-2xl border border-[#262626] bg-[#0f0f0f] p-5 text-center" role="alert">
          <Icon name="qr_code_scanner" size={32} className="mx-auto text-white/70" />
          <h2 className="mt-2 text-lg font-medium">{problem.title}</h2>
          <p className="mt-1 text-sm text-white/75">{problem.body}</p>
          <div className="mt-4 flex justify-center gap-2">
            {status !== "insecure" && status !== "unavailable" && (
              <button type="button" onClick={retry} className="press h-10 rounded-[0.625rem] bg-[#1a1a1a] px-4 text-sm font-medium">
                Try again
              </button>
            )}
            <button type="button" onClick={() => fileInput.current?.click()} className="press h-10 rounded-[0.625rem] bg-white px-4 text-sm font-medium text-[#0b0d10]">
              Upload QR image
            </button>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-[max(20px,env(safe-area-inset-bottom))] text-center">
        <p className="text-sm leading-relaxed">
          Scan a TacketPay QR code to pay
          <br />
          Money reaches them instantly over TPI
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/my-code?tab=qr" className="press flex h-10 items-center gap-2 rounded-[0.625rem] bg-[#161616]/85 px-4 text-sm backdrop-blur">
            <Icon name="qr_code_2" size={20} />
            Show my QR code
          </Link>
          <button type="button" onClick={() => fileInput.current?.click()} className="press flex h-10 items-center gap-2 rounded-[0.625rem] bg-[#161616]/85 px-4 text-sm backdrop-blur">
            <Icon name="image" size={20} />
            Upload from gallery
          </button>
        </div>
        <button type="button" onClick={tryDemoShop} className="text-xs text-white/70 underline underline-offset-4">
          No code handy? Scan a demo shop
        </button>
      </div>

      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} tabIndex={-1} aria-hidden="true" />
      <ScanResultSheet outcome={outcome} onClose={() => setOutcome(null)} />
    </div>
  );
}
