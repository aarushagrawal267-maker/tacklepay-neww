import { Suspense } from "react";
import { Balance } from "@/components/profile/Balance";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function BalancePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Balance />
    </Suspense>
  );
}
