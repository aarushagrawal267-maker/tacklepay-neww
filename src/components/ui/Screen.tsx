import type { ReactNode } from "react";

/** One app screen: fixed top bar + its own scroll area, entering like a pushed Android activity. */
export function Screen({ children, className = "", animate = true }: { children: ReactNode; className?: string; animate?: boolean }) {
  return <div className={`flex h-full flex-col bg-bg ${animate ? "animate-screen" : ""} ${className}`}>{children}</div>;
}

export function ScrollBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>{children}</main>;
}

export function ScreenSkeleton() {
  return (
    <div className="flex h-full flex-col bg-bg" aria-busy="true" aria-label="Loading">
      <div className="h-14 border-b border-line" />
      <div className="space-y-4 p-5">
        <div className="skeleton h-12 w-12 rounded-full" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </div>
  );
}
