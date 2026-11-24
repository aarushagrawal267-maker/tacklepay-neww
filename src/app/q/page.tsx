import { Suspense } from "react";
import { QrLanding } from "@/components/scan/QrLanding";

export default function QrPage() {
  return (
    <Suspense>
      <QrLanding />
    </Suspense>
  );
}
