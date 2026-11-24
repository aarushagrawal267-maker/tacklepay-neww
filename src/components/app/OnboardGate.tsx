"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHydrated, useStore } from "@/lib/store";

const OPEN_ROUTES = ["/welcome", "/q"];

/** Sends first-time visitors to the welcome screen, which explains the demo money. */
export function OnboardGate() {
  const hydrated = useHydrated();
  const onboarded = useStore((s) => s.onboarded);
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (hydrated && !onboarded && !OPEN_ROUTES.includes(pathname)) {
      const next = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
      router.replace(`/welcome${next}`);
    }
  }, [hydrated, onboarded, pathname, router]);
  return null;
}
