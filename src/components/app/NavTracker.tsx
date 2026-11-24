"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordPath } from "@/lib/nav";

export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => recordPath(pathname), [pathname]);
  return null;
}
