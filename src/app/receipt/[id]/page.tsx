import { Suspense } from "react";
import { Receipt } from "@/components/receipt/Receipt";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function ReceiptPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Receipt />
    </Suspense>
  );
}
