import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { PromoDetail } from "@/components/explore/PromoDetail";
import { OFFERS } from "@/lib/seed";

export function generateStaticParams() {
  return OFFERS.map((o) => ({ id: o.id }));
}

export default function OfferPage() {
  // Unknown params render on demand; the Suspense fallback is their prerendered shell.
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PromoDetail kind="offer" />
    </Suspense>
  );
}
