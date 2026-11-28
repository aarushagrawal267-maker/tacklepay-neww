"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScrollBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";
import { OFFERS } from "@/lib/seed";

/** "Discover offers" carousel from the reference OfferComponent. */
export function Offers() {
  const strip = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const onScroll = () => {
      const card = el.firstElementChild as HTMLElement | null;
      if (card) setIndex(Math.round(el.scrollLeft / (card.offsetWidth + 12)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "TacketPay offers", text: "Demo offers on TacketPay", url: `${window.location.origin}/offers` });
    } catch {
      // Dismissed.
    }
  };

  return (
    <Screen>
      <TopBar title="Discover offers" actions={<IconButton icon="share" label="Share" onClick={share} />} />
      <ScrollBody className="pb-10 pt-6">
        <ul ref={strip} className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6">
          {OFFERS.map((o) => (
            <li key={o.id} className="w-[84%] shrink-0 snap-start">
              <article className="flex h-[26.25rem] flex-col overflow-hidden rounded-2xl bg-surface-2">
                <div className="relative grid h-48 place-items-center text-white" style={{ background: o.tone }}>
                  <Icon name={o.icon} size={84} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs text-text-2">From {o.from}</p>
                  <h2 className="mt-1 text-lg font-medium leading-snug">{o.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-text-2">{o.description}</p>
                  <p className="mt-auto text-xs text-text-3">{o.expires} · demo reward</p>
                  <Link href={`/offers/${o.id}`} className="press mt-3 inline-flex h-10 w-fit items-center rounded-[0.625rem] border border-button-line bg-button px-4 text-sm font-medium shadow-e1">
                    See offer details
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {OFFERS.map((o, i) => (
            <span key={o.id} className={`h-1.5 rounded-full transition-colors duration-200 ${i === index ? "w-5 bg-text" : "w-1.5 bg-line-strong"}`} />
          ))}
        </div>
      </ScrollBody>
    </Screen>
  );
}
