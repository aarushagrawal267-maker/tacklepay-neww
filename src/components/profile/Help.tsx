"use client";
import { useState } from "react";
import { DemoNotice } from "@/components/ui/DemoBadge";
import { Icon } from "@/components/ui/Icon";
import { Screen, ScrollBody } from "@/components/ui/Screen";
import { TopBar } from "@/components/ui/TopBar";

const FAQ = [
  { q: "Is any of this money real?", a: "No. Every rupee in TacketPay is demo money. It has no value, can't be withdrawn, and never touches a bank or the UPI network." },
  {
    q: "How do I send demo money to a friend's phone?",
    a: "They create a TacketPay account on their phone. Then tap them under People, scan their QR code, or enter their number or TPI ID (like diya@tpay), and pay. The money leaves your balance and lands in theirs straight away, and both of you get a receipt with the same RRN.",
  },
  {
    q: "What is TPI?",
    a: "The Tacket Payment Interface: a UPI-style network for demo money. A switch checks who you're paying, debits your account, credits theirs, and if the credit fails it reverses the debit, so money is never lost halfway. Settings → TPI network shows every step.",
  },
  { q: "What PIN do I use?", a: "The 4-digit demo PIN you chose when you joined. Five wrong tries lock it for five minutes. Never type a real UPI PIN, card PIN or bank password into TacketPay." },
  { q: "Can I pay a real shop's QR code?", a: "No. If you scan a real UPI code, TacketPay tells you it's real and doesn't pay it. Use your bank's UPI app for real payments." },
  {
    q: "Where is my data stored?",
    a: "On the TacketPay server that runs this site, so your balance and history are still there when you close the app, sign out, or sign in on another phone. This phone keeps a copy so screens open instantly.",
  },
  { q: "How do scratch cards work?", a: "Demo payments of ₹10 or more earn a scratch card. Scratch it in Rewards to reveal a demo reward that's added to your balance." },
];

export function Help() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen>
      <TopBar title="Help and feedback" />
      <ScrollBody className="px-5 pb-10 pt-5">
        <DemoNotice>TacketPay is a demo. There is no support team, and no real payment can go wrong here.</DemoNotice>
        <h2 className="mt-6 text-[0.8125rem] font-medium text-text-3">Common questions</h2>
        <ul className="mt-2 divide-y divide-line">
          {FAQ.map((f, i) => (
            <li key={f.q}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 py-4 text-left text-[0.9375rem]">
                <span className="flex-1">{f.q}</span>
                <Icon name={open === i ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-text-2" />
              </button>
              {open === i && <p className="animate-fade pb-4 text-sm leading-relaxed text-text-2">{f.a}</p>}
            </li>
          ))}
        </ul>
      </ScrollBody>
    </Screen>
  );
}
