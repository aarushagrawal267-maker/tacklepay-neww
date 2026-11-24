import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { PromoDetail } from "@/components/explore/PromoDetail";
import { FOOD_PROMO, POPULAR_PROMOS } from "@/lib/seed";

export function generateStaticParams() {
  return [...POPULAR_PROMOS, FOOD_PROMO].map((p) => ({ id: p.id }));
}

export default function BusinessPromoPage() {
  // Unknown params render on demand; the Suspense fallback is their prerendered shell.
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PromoDetail kind="business" />
    </Suspense>
  );
}
