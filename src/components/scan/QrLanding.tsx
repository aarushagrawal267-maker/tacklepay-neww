"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/Logo";
import { toast } from "@/components/ui/toast";
import { payloadFromParams } from "@/lib/qr";
import { useHydrated, useStore } from "@/lib/store";
import { useQrAction } from "./useQrAction";

/**
 * Landing for TacketPay QR links opened by a phone's own camera app.
 * Puts home underneath so "back" stays inside the app, then runs the same action as the in-app scanner.
 */
export function QrLanding() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.onboarded);
  const act = useQrAction();
  const handled = useRef(false);
  const query = params.toString();
  const payload = useMemo(() => payloadFromParams(new URLSearchParams(query)), [query]);
  const problem = payload ? null : { title: "This code doesn't work", message: "The link is incomplete or was changed. Ask for a fresh TacketPay QR code." };

  useEffect(() => {
    if (!hydrated || handled.current || !payload) return;
    handled.current = true;
    if (!onboarded) {
      router.replace(`/welcome?next=${encodeURIComponent(`/q?${query}`)}`);
      return;
    }
    router.replace("/");
    // Push on top of home so back returns to TacketPay, not the camera app.
    window.setTimeout(async () => {
      const result = await act(payload, "push");
      if (result.kind === "error") toast(`${result.title}. ${result.message}`, 5000);
    }, 0);
  }, [hydrated, onboarded, query, payload, router, act]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface px-10 text-center">
      {problem ? (
        <>
          <span className="grid size-16 place-items-center rounded-2xl bg-danger-soft text-danger">
            <Icon name="error" size={32} />
          </span>
          <h1 className="text-xl font-medium">{problem.title}</h1>
          <p className="text-sm text-text-2">{problem.message}</p>
          <ButtonLink href="/" className="mt-2">
            Go home
          </ButtonLink>
        </>
      ) : (
        <>
          <LogoMark size={56} className="animate-pulse" />
          <p className="text-sm text-text-2" role="status">
            Opening code…
          </p>
        </>
      )}
    </div>
  );
}
