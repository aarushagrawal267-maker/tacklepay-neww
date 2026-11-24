import { Suspense } from "react";
import { PayFlow } from "@/components/pay/PayFlow";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function RequestPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PayFlow mode="request" />
    </Suspense>
  );
}
