import { Suspense } from "react";
import { MyCode } from "@/components/profile/MyCode";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function MyCodePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <MyCode />
    </Suspense>
  );
}
