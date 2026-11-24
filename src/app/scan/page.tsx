"use client";
import { Scanner } from "@/components/scan/Scanner";
import { useBack } from "@/components/ui/TopBar";

export default function ScanPage() {
  const back = useBack("/");
  return (
    <div className="animate-fade h-full">
      <Scanner active onClose={back} />
    </div>
  );
}
