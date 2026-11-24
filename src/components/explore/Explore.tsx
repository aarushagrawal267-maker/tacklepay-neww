"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { toast } from "@/components/ui/toast";
import { useBack } from "@/components/ui/TopBar";
import { Businesses } from "./Businesses";
import { PeopleAndBills } from "./PeopleAndBills";

const TABS = [
  { id: "people", label: "People & bills" },
  { id: "businesses", label: "Businesses" },
] as const;

export function Explore() {
  const params = useSearchParams();
  const router = useRouter();
  const back = useBack("/");
  const [query, setQuery] = useState("");
  const tab = params.get("tab") === "businesses" ? "businesses" : "people";

  return (
    <div className="animate-screen flex h-full flex-col bg-bg">
      <header className="z-10 shrink-0 border-b border-line bg-bg">
        <div className="flex h-16 items-center gap-1 px-1">
          <IconButton icon="arrow_back" label="Back" onClick={back} />
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[0.625rem] border border-line bg-surface-2 px-3 focus-within:border-primary-fg">
            <Icon name="search" className="text-text-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "people" ? "Search for people" : "Search for businesses"}
              aria-label="Search"
              className="min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-[0.9375rem] placeholder:text-text-3"
              type="search"
            />
          </label>
          <OverflowMenu items={[{ label: "Refresh", onSelect: () => toast("Up to date") }, { label: "Send feedback" }]} />
        </div>
        <div className="px-3 pb-3">
          <Segmented
            label="Explore"
            options={TABS}
            value={tab}
            onChange={(id) => router.replace(id === "people" ? "/explore" : "/explore?tab=businesses", { scroll: false })}
          />
        </div>
      </header>
      <main role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="min-h-0 flex-1 overflow-y-auto">
        {tab === "people" ? <PeopleAndBills query={query} /> : <Businesses query={query} />}
      </main>
    </div>
  );
}
