import { Suspense } from "react";
import { PayFlow } from "@/components/pay/PayFlow";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function PayPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PayFlow mode="pay" />
    </Suspense>
  );
}
