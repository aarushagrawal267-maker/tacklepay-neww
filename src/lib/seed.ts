// Seed data, adapted from the reference app's DataProvider with every brand,
// bank and person replaced by fictional ones.
import type { IconName } from "@/components/ui/icon-paths";
import type { Contact, State } from "./types";

export const AVATAR_COLORS = [
  "#E8710A", "#1E8E3E", "#D93025", "#9334E6", "#129EAF",
  "#C5221F", "#B06000", "#185ABC", "#AF5CF7", "#00796B",
];

export function colorFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// People are no longer seeded: everyone in "People" is a real TacketPay account on the TPI network.

const business = (id: string, name: string, icon: IconName, color: string, subtitle: string): Contact => ({
  id,
  name,
  handle: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@tacket`,
  kind: "business",
  color,
  icon,
  subtitle,
});

export const SEED_BUSINESSES: Contact[] = [
  business("b-chai", "Chai Point", "restaurant", "#B06000", "Food & drinks"),
  business("b-kirana", "Daily Kirana", "storefront", "#1E8E3E", "Essentials"),
  business("b-metro", "MetroCard", "directions_bus", "#185ABC", "Travel"),
  business("b-fuel", "Fuel Stop", "local_gas_station", "#D93025", "Local services"),
  business("b-cine", "CinePlex", "movie", "#9334E6", "Shopping"),
  business("b-mart", "QuickMart", "local_mall", "#129EAF", "Shopping"),
  business("b-air", "SkyHop Air", "flight", "#00796B", "Travel"),
  business("b-tiffin", "Tiffin Co", "restaurant", "#C5221F", "Food & drinks"),
];

export const BUSINESS_TYPES: { id: string; label: string; icon: IconName }[] = [
  { id: "spots", label: "Spots", icon: "storefront" },
  { id: "essentials", label: "Essentials", icon: "local_mall" },
  { id: "shopping", label: "Shopping", icon: "shopping_bag" },
  { id: "local", label: "Local services", icon: "bolt" },
  { id: "travel", label: "Travel", icon: "flight" },
];

export interface Offer {
  id: string;
  title: string;
  description: string;
  details: string;
  expires: string;
  icon: IconName;
  tone: string;
  from: string;
}

export const OFFERS: Offer[] = [
  {
    id: "o-gift",
    title: "Earn up to ₹150",
    description: "On your first ever gift code purchase of ₹30 or more.",
    details: "Buy any gift code worth ₹30 or more using TacketPay and get a scratch card worth up to ₹150 in demo money.",
    expires: "Offer expires 31 December",
    icon: "redeem",
    tone: "#1E8E3E",
    from: "TacketPay",
  },
  {
    id: "o-stream",
    title: "Get up to ₹399 on StreamBox Premium",
    description: "Use TacketPay to buy a 3-month plan and get up to ₹399 back.",
    details: "Pay for a StreamBox Premium 3-month plan with TacketPay and receive a guaranteed scratch card. Demo money only.",
    expires: "Offer expires 31 January",
    icon: "subscriptions",
    tone: "#D93025",
    from: "StreamBox",
  },
  {
    id: "o-power",
    title: "Get ₹20 to ₹2,000 on electricity bill pay",
    description: "Make your 1st and 2nd electricity bill payments on TacketPay.",
    details: "Link your electricity account and pay your bill twice in a month. Each payment earns a scratch card.",
    expires: "Offer expires 28 February",
    icon: "lightbulb",
    tone: "#F29900",
    from: "TacketPay Bills",
  },
  {
    id: "o-card",
    title: "Get up to ₹399 with Demo Card",
    description: "On your first ever transaction of ₹30 or more using a Demo Card.",
    details: "Add a Demo Card in Payment methods and make a payment of ₹30 or more.",
    expires: "Offer expires 31 March",
    icon: "credit_card",
    tone: "#185ABC",
    from: "Demo Card",
  },
];

export interface Promo {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  brand: string;
}

export const POPULAR_PROMOS: Promo[] = [
  { id: "p-trip", title: "Popular! Get 8% off SkyHop flights", subtitle: "Save up to ₹1,000 on your flight", image: "/images/travel.jpg", brand: "SkyHop Air" },
  { id: "p-bus", title: "Save up to ₹300 on your first BusBee ticket", subtitle: "Use code TPFIRST, now till Nov 30", image: "/images/bus.jpg", brand: "BusBee" },
  { id: "p-gift", title: "Get 20% off your first Dropkart order", subtitle: "Save up to ₹100, now till Dec 31", image: "/images/gift.jpg", brand: "Dropkart" },
];

export const FOOD_PROMO: Promo = {
  id: "p-food",
  title: "Feeling hungry? Discover restaurants here now!",
  subtitle: "Tiffin Co",
  image: "/images/food.jpg",
  brand: "Tiffin Co",
};

export interface BillCategory {
  id: string;
  name: string;
  icon: IconName;
  providers: { id: string; name: string }[];
}

export const BILL_CATEGORIES: BillCategory[] = [
  {
    id: "dth",
    name: "DTH / Cable TV",
    icon: "tv",
    providers: [
      { id: "skydish", name: "SkyDish TV" },
      { id: "starwave", name: "StarWave Digital TV" },
      { id: "act", name: "Orbit Cable" },
      { id: "home", name: "HomeView DTH" },
    ],
  },
  {
    id: "electricity",
    name: "Electricity",
    icon: "lightbulb",
    providers: [
      { id: "metro-power", name: "Metro Power Distribution" },
      { id: "sun-grid", name: "SunGrid Electric" },
      { id: "state-elec", name: "State Electricity Board (Demo)" },
      { id: "volt", name: "VoltCity" },
    ],
  },
  {
    id: "postpaid",
    name: "Postpaid mobile",
    icon: "mobile",
    providers: [
      { id: "tel-one", name: "TelOne Postpaid" },
      { id: "airwave", name: "AirWave Postpaid" },
      { id: "jet", name: "JetMobile Postpaid" },
    ],
  },
  {
    id: "gift",
    name: "Gift codes",
    icon: "redeem",
    providers: [{ id: "appstore-code", name: "AppShelf Recharge Code" }],
  },
  {
    id: "broadband",
    name: "Broadband / Landline",
    icon: "router",
    providers: [
      { id: "fibernet", name: "FiberNet Broadband" },
      { id: "lightlink", name: "LightLink" },
      { id: "cityline", name: "CityLine Landline" },
    ],
  },
  {
    id: "water",
    name: "Water",
    icon: "water_drop",
    providers: [{ id: "jal", name: "City Water Board (Demo)" }],
  },
];

export const OPERATORS = [
  { id: "tel-one", name: "TelOne Prepaid", color: "#D93025" },
  { id: "airwave", name: "AirWave Prepaid", color: "#185ABC" },
  { id: "jet", name: "JetMobile Prepaid", color: "#1E8E3E" },
];

export interface Plan {
  amount: number; // rupees
  validity: string;
  description: string;
}

export const PLAN_TABS: { id: string; label: string; plans: Plan[] }[] = [
  {
    id: "for-you",
    label: "For you",
    plans: [
      { amount: 249, validity: "28 days", description: "Double data offer. Unlimited local/national calls + 1.5GB/day + extra 1.5GB/day + 100 SMS/day." },
      { amount: 219, validity: "28 days", description: "Unlimited local/national calls to all networks + 1GB/day + 100 SMS/day." },
      { amount: 399, validity: "56 days", description: "Double data offer. Unlimited calls + 1.5GB/day + extra 1.5GB/day + 100 SMS/day." },
      { amount: 599, validity: "84 days", description: "Double data offer. Unlimited calls + 1.5GB/day + extra 1.5GB/day + 100 SMS/day." },
      { amount: 16, validity: "1 day", description: "1GB 4G/3G/2G data." },
      { amount: 48, validity: "28 days", description: "1GB 4G/3G/2G data." },
    ],
  },
  {
    id: "recommended",
    label: "Recommended",
    plans: [
      { amount: 795, validity: "84 days", description: "1 year StreamBox Premium + 2GB/day + unlimited calls + 100 SMS/day. Weekend data roll-over." },
      { amount: 1499, validity: "365 days", description: "Truly unlimited calls + 24GB data + 3,600 SMS." },
      { amount: 2399, validity: "365 days", description: "Truly unlimited calls + 1.5GB/day + 100 SMS/day." },
    ],
  },
  {
    id: "data",
    label: "Data",
    plans: [
      { amount: 19, validity: "1 day", description: "1GB high-speed data." },
      { amount: 58, validity: "28 days", description: "3GB high-speed data." },
      { amount: 98, validity: "21 days", description: "5GB high-speed data." },
    ],
  },
  {
    id: "special",
    label: "Special recharge",
    plans: [
      { amount: 995, validity: "7 days", description: "Up to 150 mins OG and IC + up to 500MB data." },
      { amount: 1495, validity: "7 days", description: "Up to 300 mins OG and IC + up to 500MB data." },
    ],
  },
  {
    id: "roaming",
    label: "Roaming",
    plans: [{ amount: 599, validity: "10 days", description: "International roaming: 100 mins + 1GB data." }],
  },
  {
    id: "topup",
    label: "Top-up",
    plans: [
      { amount: 1000, validity: "Talktime ₹847.46", description: "Talktime of ₹847.46." },
      { amount: 5000, validity: "Talktime ₹4,237.29", description: "Talktime of ₹4,237.29." },
      { amount: 12, validity: "10 days", description: "Talktime of ₹7.47." },
    ],
  },
  {
    id: "others",
    label: "Others",
    plans: [
      { amount: 26, validity: "28 days", description: "250 SMS local and national." },
      { amount: 38, validity: "60 days", description: "ISD pack." },
    ],
  },
];

export const STARTING_BALANCE = 10_000_00;
export const DEMO_BANK = "Tacket Demo Bank";

/**
 * A public demo server (NEXT_PUBLIC_TPI_PUBLIC_DEMO=1, e.g. the Hugging Face Space) opens these two accounts
 * when it starts, and its welcome screen lists them, so a visitor can try a payment without a second person.
 * They are the same accounts `npm run smoke` uses. Demo PINs only: never a real one.
 */
export const PUBLIC_DEMO = process.env.NEXT_PUBLIC_TPI_PUBLIC_DEMO === "1";
export const DEMO_ACCOUNTS = [
  { name: "Diya", phone: "9876543210", pin: "1234" },
  { name: "Aarush", phone: "9123456789", pin: "4321" },
] as const;

/** Handles of fictional billers and recharge operators. All of them are shops on the Tacket participant. */
export function billerHandle(providerId: string): string {
  return `${providerId.replace(/[^a-z0-9]+/g, ".")}.bills@tacket`;
}

export function operatorHandle(operatorId: string): string {
  return `${operatorId}.prepaid@tacket`;
}

/** Every shop, biller and operator that can be paid over TPI. The server opens a ledger account for each. */
export const MERCHANTS: Contact[] = [
  ...SEED_BUSINESSES,
  ...BILL_CATEGORIES.flatMap((c) =>
    c.providers.map(
      (p): Contact => ({ id: `bill-${p.id}`, name: p.name, handle: billerHandle(p.id), kind: "biller", color: colorFor(p.name), subtitle: c.name }),
    ),
  ),
  ...OPERATORS.map(
    (o): Contact => ({ id: `op-${o.id}`, name: o.name, handle: operatorHandle(o.id), kind: "biller", color: o.color, subtitle: "Mobile recharge" }),
  ),
];

/** Signed-out state. Also the server snapshot during prerender, so it must be deterministic. */
export function initialState(): State {
  return {
    version: 2,
    onboarded: false,
    rev: "",
    profile: { name: "", handle: "", phone: "" },
    referralCode: "",
    accounts: [],
    cards: [],
    contacts: MERCHANTS,
    messages: [],
    transactions: [],
    rewards: [],
    linkedBills: [],
    theme: "system",
  };
}
