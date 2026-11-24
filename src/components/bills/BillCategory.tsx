"use client";
import { useParams } from "next/navigation";
import { NotFound } from "@/components/ui/NotFound";
import { Screen, ScrollBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { BILL_CATEGORIES } from "@/lib/seed";
import { ProviderRow } from "./Bills";

export function BillCategory() {
  const { category } = useParams<{ category: string }>();
  const cat = BILL_CATEGORIES.find((c) => c.id === category);
  if (!cat) return <NotFound title="Category not found" body="Pick a bill type from Bill payments." />;
  return (
    <Screen>
      <TopBar title={cat.name} fallback="/bills" />
      <ScrollBody className="px-5 py-2">
        <ul>
          {cat.providers.map((p) => (
            <li key={p.id}>
              <ProviderRow href={`/bills/${cat.id}/${p.id}`} name={p.name} detail="Bill payments" />
            </li>
          ))}
        </ul>
      </ScrollBody>
    </Screen>
  );
}
