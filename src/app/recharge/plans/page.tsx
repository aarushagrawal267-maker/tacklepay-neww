import { Suspense } from "react";
import { Plans } from "@/components/recharge/Plans";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function PlansPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Plans />
    </Suspense>
  );
}
