"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { ContactAvatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useBusinesses } from "@/lib/hooks";
import { FOOD_PROMO, POPULAR_PROMOS, type Promo } from "@/lib/seed";
import type { Contact } from "@/lib/types";

const SUBLISTS: { title: string; ids: string[]; cta: string }[] = [
  { title: "Travel", ids: ["b-metro", "b-air"], cta: "Book travel" },
  { title: "Food", ids: ["b-tiffin", "b-chai"], cta: "Order food" },
];

export function Businesses({ query }: { query: string }) {
  const businesses = useBusinesses();
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => businesses.filter((b) => b.name.toLowerCase().includes(q) || (b.subtitle ?? "").toLowerCase().includes(q)), [businesses, q]);

  if (q) {
    return (
      <ul className="px-4 py-3">
        {matches.length === 0 && <li className="px-2 py-6 text-sm text-text-2">No businesses match “{query}”.</li>}
        {matches.map((b) => (
          <li key={b.id}>
            <BusinessRow b={b} cta="Pay" />
          </li>
        ))}
      </ul>
    );
  }

  const byId = new Map(businesses.map((b) => [b.id, b]));
  return (
    <div className="pb-10 pt-4">
      <Title>Popular</Title>
      <PromoStrip promos={POPULAR_PROMOS} />
      <SubList title="Travel" items={SUBLISTS[0].ids.map((id) => byId.get(id)).filter((b): b is Contact => !!b)} cta={SUBLISTS[0].cta} />
      <Title next>Food</Title>
      <PromoStrip promos={[FOOD_PROMO]} />
      <SubList title="Food" items={SUBLISTS[1].ids.map((id) => byId.get(id)).filter((b): b is Contact => !!b)} cta={SUBLISTS[1].cta} />
      <Title>All businesses</Title>
      <ul className="mx-5 mt-3 rounded-2xl bg-surface-2 px-4 py-2">
        {businesses.map((b) => (
          <li key={b.id}>
            <BusinessRow b={b} cta="Pay" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Title({ children, next }: { children: React.ReactNode; next?: boolean }) {
  return (
    <div className="mt-6 flex items-center justify-between px-5 first:mt-0">
      <h2 className="text-xl font-medium">{children}</h2>
      {next && (
        <span className="grid size-8 place-items-center rounded-[0.625rem] bg-surface-3" aria-hidden="true">
          <Icon name="chevron_right" size={20} />
        </span>
      )}
    </div>
  );
}

function PromoStrip({ promos }: { promos: Promo[] }) {
  return (
    <ul className="no-scrollbar mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5">
      {promos.map((p) => (
        <li key={p.id} className="relative h-[13.75rem] w-[85%] max-w-[18.75rem] shrink-0 snap-center overflow-hidden rounded-2xl">
          <Image src={p.image} alt="" fill sizes="300px" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="relative flex h-full flex-col justify-center p-5 text-white">
            <p className="text-xl leading-tight">{p.title}</p>
            <p className="mt-1.5 text-xs text-white/90">{p.subtitle}</p>
            <Link href={`/business/${p.id}`} className="press mt-5 inline-flex h-9 w-fit items-center rounded-[0.625rem] bg-white px-4 text-sm font-medium text-[#0b0d10]">
              Buy now
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SubList({ title, items, cta }: { title: string; items: Contact[]; cta: string }) {
  return (
    <ul className="mx-5 mt-4 rounded-2xl bg-surface-2 px-4 py-2" aria-label={`${title} businesses`}>
      {items.map((b) => (
        <li key={b.id}>
          <BusinessRow b={b} cta={cta} />
        </li>
      ))}
    </ul>
  );
}

function BusinessRow({ b, cta }: { b: Contact; cta: string }) {
  return (
    <Link href={`/chat/${b.id}`} className="press -mx-2 flex items-center gap-3 rounded-xl px-2 py-3">
      <ContactAvatar contact={b} size={44} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{b.name}</span>
        <span className="block truncate text-[0.8125rem] text-text-2">{b.subtitle}</span>
      </span>
      <span className="text-sm font-medium text-primary-fg">{cta}</span>
    </Link>
  );
}
