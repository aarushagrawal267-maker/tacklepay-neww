import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { BillProvider } from "@/components/bills/BillProvider";
import { BILL_CATEGORIES } from "@/lib/seed";

export function generateStaticParams() {
  return BILL_CATEGORIES.flatMap((c) => c.providers.map((p) => ({ category: c.id, provider: p.id })));
}

export default function BillProviderPage() {
  // Unknown params render on demand; the Suspense fallback is their prerendered shell.
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BillProvider />
    </Suspense>
  );
}
