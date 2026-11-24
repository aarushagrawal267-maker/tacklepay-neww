import { Suspense } from "react";
import { Welcome } from "@/components/onboarding/Welcome";

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
