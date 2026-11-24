"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { decodeFrame } from "./decoder";

export type CameraStatus = "idle" | "starting" | "live" | "denied" | "unavailable" | "insecure" | "error";

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

/** Owns the camera stream for the scanner. Stops the camera whenever `active` goes false. */
export function useCamera(active: boolean, onCode: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer = 0;

    const stop = () => {
      window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    (async () => {
      if (!window.isSecureContext) return setStatus("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return setStatus("unavailable");
      setStatus("starting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as TorchCapabilities;
        setTorchSupported(!!caps.torch);
        setStatus("live");

        const tick = async () => {
          if (cancelled) return;
          try {
            const text = await decodeFrame(video);
            if (text && !cancelled) {
              onCodeRef.current(text);
              return; // The parent decides whether to resume by toggling `active`.
            }
          } catch (err) {
            console.warn("[tacketpay] QR decode failed", err);
          }
          timer = window.setTimeout(tick, 180);
        };
        tick();
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" || name === "OverconstrainedError" ? "unavailable" : "error");
      }
    })();

    return () => {
      cancelled = true;
      stop();
      setTorchOn(false);
      setStatus("idle");
    };
  }, [active, attempt]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { videoRef, status, torchSupported, torchOn, toggleTorch, retry };
}
