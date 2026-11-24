import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/Screen";
import { BillCategory } from "@/components/bills/BillCategory";
import { BILL_CATEGORIES } from "@/lib/seed";

export function generateStaticParams() {
  return BILL_CATEGORIES.map((c) => ({ category: c.id }));
}

export default function BillCategoryPage() {
  // Unknown params render on demand; the Suspense fallback is their prerendered shell.
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <BillCategory />
    </Suspense>
  );
}
