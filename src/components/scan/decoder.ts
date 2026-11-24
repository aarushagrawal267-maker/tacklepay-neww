"use client";
// Two decoders: the native BarcodeDetector where it exists (Chrome on Android, Safari 17+ ships
// it behind flags), and jsQR everywhere else. jsQR is only downloaded when needed.

type Source = HTMLVideoElement | HTMLImageElement | ImageBitmap;

interface NativeDetector {
  detect(source: Source): Promise<{ rawValue: string }[]>;
}

let native: Promise<NativeDetector | null> | null = null;

function getNative(): Promise<NativeDetector | null> {
  if (!native) {
    native = (async () => {
      const BD = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): NativeDetector; getSupportedFormats(): Promise<string[]> } })
        .BarcodeDetector;
      if (!BD) return null;
      try {
        const formats = await BD.getSupportedFormats();
        return formats.includes("qr_code") ? new BD({ formats: ["qr_code"] }) : null;
      } catch {
        return null;
      }
    })();
  }
  return native;
}

let canvas: HTMLCanvasElement | null = null;

async function decodeWithJsQr(source: Source, width: number, height: number): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  // Downscale: jsQR is plenty accurate at ~640px and much faster.
  const scale = Math.min(1, 640 / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  canvas ??= document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  return jsQR(data.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

export async function decodeFrame(video: HTMLVideoElement): Promise<string | null> {
  if (video.readyState < 2 || !video.videoWidth) return null;
  const det = await getNative();
  if (det) {
    try {
      const codes = await det.detect(video);
      return codes[0]?.rawValue ?? null;
    } catch {
      // Fall through to jsQR.
    }
  }
  return decodeWithJsQr(video, video.videoWidth, video.videoHeight);
}

export async function decodeFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const det = await getNative();
    if (det) {
      try {
        const codes = await det.detect(bitmap);
        if (codes[0]) return codes[0].rawValue;
      } catch {
        // Fall through to jsQR.
      }
    }
    return await decodeWithJsQr(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}
