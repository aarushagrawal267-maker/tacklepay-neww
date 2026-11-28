"use client";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Button, IconButton } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { NotFound } from "@/components/ui/NotFound";
import { toast } from "@/components/ui/toast";
import { TopBar } from "@/components/ui/TopBar";
import { FOOD_PROMO, OFFERS, POPULAR_PROMOS, SEED_BUSINESSES } from "@/lib/seed";

/** Offer / "Buy now" detail page from the reference GPOfferDetails and BusinessBuyNow components. */
export function PromoDetail({ kind }: { kind: "offer" | "business" }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const offer = kind === "offer" ? OFFERS.find((o) => o.id === id) : undefined;
  const promo = kind === "business" ? [...POPULAR_PROMOS, FOOD_PROMO].find((p) => p.id === id) : undefined;
  if (!offer && !promo) return <NotFound title="Offer not found" body="It may have expired." />;

  const title = offer?.title ?? promo!.title;
  const description = offer?.description ?? promo!.subtitle;
  const details = offer?.details ?? `${promo!.brand} is a fictional brand. Paying with TacketPay earns a scratch card with demo money.`;
  const expires = offer?.expires ?? "Offer expires 31 December";
  const payee = promo ? SEED_BUSINESSES.find((b) => b.name.startsWith(promo.brand.split(" ")[0])) ?? SEED_BUSINESSES[5] : SEED_BUSINESSES[5];

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, text: `${title} — on TacketPay (demo).` });
      else toast("Sharing isn't supported here");
    } catch {
      // Dismissed.
    }
  };

  return (
    <div className="animate-screen relative flex h-full flex-col bg-surface">
      <TopBar nav="close" elevated={false} actions={<IconButton icon="share" label="Share" onClick={share} />} menu={[{ label: "Report offer", onSelect: () => toast("Thanks — reported") }, { label: "Send feedback" }]} />
      <main className="min-h-0 flex-1 overflow-y-auto pb-28">
        <div className="relative mx-4 mt-2 h-48 overflow-hidden rounded-2xl" style={{ background: offer?.tone }}>
          {promo ? (
            <Image src={promo.image} alt="" fill sizes="360px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-white">
              <Icon name={offer!.icon} size={88} />
            </div>
          )}
        </div>
        <div className="px-5 pt-5">
          <p className="text-xs text-text-2">From {offer?.from ?? promo!.brand}</p>
          <h1 className="mt-1 text-2xl font-medium leading-tight">{title}</h1>
          <p className="mt-2 text-[0.9375rem] text-text-2">{description}</p>
          <DemoBadge className="mt-3" />
          <h2 className="mt-7 text-sm font-medium">Offer dates</h2>
          <p className="mt-1 text-sm text-text-2">{expires}</p>
          <h2 className="mt-5 text-sm font-medium">Details</h2>
          <p className="mt-1 text-sm leading-relaxed text-text-2">{details}</p>
          <h2 className="mt-5 text-sm font-medium">Terms and conditions</h2>
          <p className="mt-1 text-sm leading-relaxed text-text-2">Rewards are demo money with no cash value. One reward per TacketPay ID. Offer is part of a product demo and may change at any time.</p>
        </div>
      </main>
      <div className="absolute inset-x-0 bottom-0 bg-surface px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-1px_4px_rgb(0_0_0/0.08)]">
        <Button block size="lg" onClick={() => router.push(`/chat/${payee.id}`)}>
          {kind === "offer" ? "Start transacting" : "Buy now"}
        </Button>
      </div>
    </div>
  );
}
