# TacketPay design notes

## Brief

Rebuild the GpayApp-Flutter UI kit as a mobile-only web app, branded TacketPay, with two additions:
**the money must be clearly fake**, and **QR must work for real**.

Fidelity rule: match the kit's layout, spacing, type sizes, colours and interaction patterns screen by
screen. Replace only what would make the replica misleading:

| Kit had | TacketPay uses | Why |
| --- | --- | --- |
| Google Pay logo and name | Original ticket-stub "T" mark, *TacketPay* wordmark | A pixel-copy of a payment brand on a fake-money app is the setup for fake-payment-screenshot scams |
| Bank, Play, YouTube, Visa, Paytm-style logos | Letter and icon avatars; fictional brands (SkyHop, BusBee, Dropkart…) | Trademarks |
| Stock photos of people | Neutral letter avatars | Unknown photo licences; no real faces in a payments demo |
| "Spot code" | Your payment QR plus a shareable profile link | Spot is a Google-specific concept; QR is the requested feature |
| 6-digit passcode, any value | 4-digit **demo PIN** chosen at sign-up and checked by TacketPay's server, with a "never type a real UPI PIN" note | Never train people to type real PINs into a web page |

## The "this is fake" system

Fake money is a first-class design element, not a footnote. It shows up wherever money does:

- **Welcome** screen explains it before any money appears, and you start with ₹10,000 of demo money.
- **Demo money** chip (amber, flask icon) in the home top bar, on My QR, balance, rewards and history.
- **Amount screen**: "DEMO MONEY · NO REAL PAYMENT" directly under the figure.
- **Receipts**: a diagonal "DEMO MONEY · NOT REAL" watermark across both the hero and the details card,
  a pill in the hero, "RRN" and "TPI transaction ID" in place of "UPI transaction ID", and a notice that receipts
  aren't proof of payment. Shared receipt text starts with "TacketPay DEMO receipt — not a real payment".
- **Chat payment bubbles** carry a small DEMO tag.
- **Scanner**: real `upi://` codes are recognised and refused with an explanation.
- **Desktop panel** repeats the disclaimer next to the phone frame.

The amber family (`--demo-bg #fff4ce`, `--demo-ink #6b4a00`) is reserved for this message, so it never
blends into the blue product UI.

## Visual language (v2: Tacket ledger)

The first build copied the GPay kit's look. v2 keeps every screen, option and flow from the kit, and
re-skins them in the Tacket ledger style:

- **Surfaces:** white or pure-black pages. Stat tiles have hairline borders (`--line`); list cards sit on a
  soft fill (`--surface-2`). Dark mode is `#000`, not navy, with `#0f0f0f` cards and `#1f1f1f` hairlines.
- **Type:** Inter for text. **Geist Mono for every amount** (`.money`), so figures line up like a ledger.
- **Status pills:** small 6px-radius tinted badges: danger (Overdue), warn (Pending / Partly paid),
  info (Open), success (Paid / Automatic), and amber for Demo money.
- **Avatars:** rounded-square initials tiles in neutral grey (`--surface-3`) in both themes, so a grid of
  contacts and billers reads like a ledger column. Contact colours stay in the data but are not painted.
- **Buttons:** a flat brand-blue primary (`--primary`) with no gradient, gloss or glow; white outlined
  secondary with a 1px shadow (a borderless `#161616` chip in dark mode); 10px radius. Blue is the one
  key action on a screen, such as New payment or Proceed to pay. The Add money sheet uses a full black pill (white in dark), as
  in its reference.
- **Controls:** a segmented control for two-way switches (People / Businesses, Explore tabs), and
  pill-row tabs for recharge plans.
- **Weights and labels:** 400 and 500, with 600 only for the welcome headline. Labels are sentence case;
  the only capitals are the receipt watermark, which is a rubber stamp, not a label.
- **Stub edge (signature):** wherever money settles, a card tears along a perforation: a dashed line with
  a half-round notch cut into each side, grown from the "T" stub mark and the `.dashed` rule. It appears
  on the receipt (amount above, counterfoil details below), the confirm sheet (who pays whom above, the
  fare below) and the wallet balance card, and nowhere else. Use `<Perforation />` inside a `.stub` card,
  and set `--notch` when the card sits on something other than `--bg`.
- **Motion:** named transitions only (`transition-colors`, `transition-[translate,scale,color]`), never
  `transition-all` or animated layout properties. Screens enter with a 12px slide and content rises 8px.
  Nothing loops except live states: the scanner line while the camera runs, spinners and the coin ring.

| Token | Light | Dark |
| --- | --- | --- |
| `--bg` | `#ffffff` | `#000000` |
| `--surface-2` (card fill) | `#f6f7f9` | `#0f0f0f` |
| `--surface-3` (track, chips) | `#eef0f3` | `#1a1a1a` |
| `--line` | `#e6e8eb` | `#1f1f1f` |
| `--text` / `--text-2` / `--text-3` | `#0b0d10` / `#5f6670` / `#8b929b` | `#f5f5f5` / `#a3a3a3` / `#737373` |
| `--primary` (flat) | `#1f6ff2` | same |
| `--danger` (overdue, paid out) | `#d92d20` | `#f08a8a` |
| `--due` (due soon, received) | `#c2570c` | `#f0a06a` |
| `--success` | `#15803d` | `#4ade80` |
| `--demo-*` | `#fdf2e2` / `#92400e` | `#261a06` / `#fbbf5a` |

## Add money

Modelled on Plasma's Add money sheet (the reference video):

1. **Menu:** the balance ("Spendable") sits behind a 28px-radius sheet. A 3D ring of 14 coins turns
   continuously. CSS `preserve-3d`, each coin `rotateY(i·step) translateZ(r)`, hidden backfaces and a few
   stacked rims for thickness. It holds still under `prefers-reduced-motion`. Below are two option cards
   with overlapping mini-coin or avatar stacks and a "+N" count.
2. **Add from bank:** a floating coin cluster, a title, a numbered two-step card, a footnote and a black
   pill **Continue**. Then amount entry (mono figure, quick +₹ chips, keypad) → demo PIN → success with the
   new balance. Logic lives in `addMoney()`, which is capped at ₹1,00,000 per top-up and ₹10,00,000 per
   balance, and is unit-tested.
3. **Receive from a friend:** two paged slides with dots and **Next**, ending in **Show my QR code** or
   **Scan a receipt**.

The coins are original SVG flags (India, US, EU, UK, Japan, UAE, Brazil, Colombia) and currency glyphs.
No crypto or brand logos are used.

## Screen map (Flutter → web)

| Flutter (`lib/…`) | Route |
| --- | --- |
| — (new) | `/add-money` (Plasma-style Add money sheet) |
| `SplashScreen` | Cold-start splash (`components/app/Splash.tsx`) |
| `MainScreen` PageView (home ↔ scanner) | `/` (`HomePager`: `row-reverse` scroll-snap, swipe right for the camera) |
| `HomeScreen` | `/` (`Home`: GPay arrangement: illustrated band, rounded sheet, 4-up grids, floating New payment) |
| `QrScannerComponent` + camera | `/scan`, and the pager's scanner pane |
| `ChatScreen`, `MessageComponent` | `/chat/[id]` |
| `PayComponent` + `NumericPad` | `/pay/[id]`, `/request/[id]` |
| `ProcessToPayComponent` | Confirm sheet inside the pay flow |
| `PinVerifyScreen` | Demo PIN overlay (also guards balance and self transfer) |
| — (new) | `/receipt/[id]`: success animation, watermark, RRN and TPI transaction ID (both phones show the same RRN) |
| `ProfileComponent` | `/profile` |
| `ProfileDetailsScreenComponent` | `/my-code` (profile page + payment QR page) |
| `SettingsComponent` | `/settings` |
| `PaymentMethodComponent` | `/payment-methods` |
| `AllPaymentActivityComponent` | `/transactions` |
| `ExploreScreen`, `PeopleAndBillsComponent`, `BusinessesComponent` | `/explore`, `/explore?tab=businesses` |
| `BillPaymentsScreen`, `DetailsComponent`, `LinkComponent`, `LinkFormComponent` | `/bills`, `/bills/[category]`, `/bills/[category]/[provider]` |
| `MobileRechargeScreen`, `RechargeTabComponent` | `/recharge`, `/recharge/plans` |
| `BankTransferComponent` | `/bank-transfer` |
| `PhoneNumberComponent` | `/phone` |
| `SelfTransferComponent` | `/self-transfer` (made functional) |
| `RewardComponent` (scratcher) | `/rewards` (canvas scratch card) |
| `OfferComponent`, `GPOfferDetailsComponent` | `/offers`, `/offers/[id]` |
| `BusinessBuyNowComponent` | `/business/[id]` |
| `ReferralsComponent`, `ReferralCodeComponent` | `/referrals` |

## Responsive sizing

Every size (type, spacing, avatars, icons, coins, QR codes) is in rem. The `rem()` helper converts design
pixels for numeric props. On phones the root font size is `clamp(14.5px, 4.1026vw, 18px)`, which is 16px at
the 390px reference width. Layouts therefore keep their proportions instead of looking cramped on small
Androids and tiny on large iPhones. On iOS the floor is 16px, so text inputs never trigger Safari's
zoom-on-focus. Rows that used to scroll sideways (bill suggestions, recharge plan tabs, home shortcut chips)
now wrap, so nothing is cut off at the screen edge. The only sideways scrollers left are the deliberate
swipe carousels (promos and offers), which snap and show dots.

## Mobile-only

Below 640px the app fills the screen. Wider viewports get a 400×860 device frame with an "open on your
phone" QR beside it. The frame uses `transform: translateZ(0)`, which makes it the containing block for
`position: fixed`, so sheets, dialogs and the floating button stay inside the phone. The layout is
never stretched into a desktop UI.

## Accessibility

- Semantic buttons and links throughout, with visible focus rings. Sheets and dialogs trap focus, close
  on Escape, and restore focus afterwards.
- The page behind the PIN overlay is `inert`.
- The scratch card has a "Tap to reveal" button, so keyboard and screen-reader users get the same result.
- Amounts are announced through `<output aria-live>`.
