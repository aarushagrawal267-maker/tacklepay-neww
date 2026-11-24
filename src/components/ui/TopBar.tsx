"use client";
import { useRouter } from "next/navigation";
import { canGoBack } from "@/lib/nav";
import type { ReactNode } from "react";
import { IconButton } from "./Button";
import { FEEDBACK_ITEM, OverflowMenu, type MenuItem } from "./OverflowMenu";

export function useBack(fallback = "/") {
  const router = useRouter();
  return () => {
    if (canGoBack()) router.back();
    else router.replace(fallback);
  };
}

interface TopBarProps {
  title?: ReactNode;
  nav?: "back" | "close" | "none";
  onNav?: () => void;
  menu?: MenuItem[] | false;
  actions?: ReactNode;
  elevated?: boolean;
  tone?: "surface" | "primary" | "clear" | "profile";
  fallback?: string;
}

const tones = {
  surface: "bg-bg text-text",
  primary: "bg-bg text-text",
  clear: "bg-transparent text-text",
  profile: "bg-bg text-text",
};

export function TopBar({ title, nav = "back", onNav, menu = [FEEDBACK_ITEM], actions, elevated = true, tone = "surface", fallback }: TopBarProps) {
  const back = useBack(fallback);
  return (
    <header className={`relative z-20 flex h-14 shrink-0 items-center gap-1 px-1 ${tones[tone]} ${elevated ? "border-b border-line" : ""}`}>
      {nav !== "none" && (
        <IconButton icon={nav === "close" ? "close" : "arrow_back"} label={nav === "close" ? "Close" : "Back"} onClick={onNav ?? back} />
      )}
      <h1 className={`min-w-0 flex-1 truncate text-[1.0625rem] font-medium ${nav === "none" ? "pl-4" : ""}`}>{title}</h1>
      {actions}
      {menu && menu.length > 0 && <OverflowMenu items={menu} />}
    </header>
  );
}
