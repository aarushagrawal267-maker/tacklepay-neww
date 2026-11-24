import { Suspense } from "react";
import { Explore } from "@/components/explore/Explore";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function ExplorePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Explore />
    </Suspense>
  );
}
